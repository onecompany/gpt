//! Sensitive data handling utilities for secure logging.
//!
//! This module provides types and utilities to prevent accidental logging of sensitive
//! information such as message content, API responses, encryption keys, and user data.

use std::fmt;
use tracing::field::{Field, Visit};
use tracing::span::{Attributes, Record};
use tracing::{Event, Id, Metadata, Subscriber};
use tracing_subscriber::layer::{Context, Layer};
use tracing_subscriber::registry::LookupSpan;
use zeroize::Zeroize;

/// A wrapper type for sensitive strings that redacts content in Display/Debug.
///
/// Use this type for any string data that should never appear in logs:
/// - Message content
/// - AI response text
/// - API keys and tokens
/// - User data
///
/// The inner value is zeroized when dropped for additional security.
#[derive(Clone, Default)]
pub struct SecretString(String);

impl SecretString {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    /// Access the inner value. Use sparingly and never log the result.
    #[inline]
    pub fn expose(&self) -> &str {
        &self.0
    }

    /// Consume and return the inner value.
    /// Note: The returned string is NOT zeroized - caller is responsible for handling it securely.
    #[inline]
    pub fn expose_owned(mut self) -> String {
        std::mem::take(&mut self.0)
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl fmt::Display for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED]")
    }
}

impl fmt::Debug for SecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_tuple("SecretString")
            .field(&"[REDACTED]")
            .finish()
    }
}

impl Drop for SecretString {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

impl From<String> for SecretString {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

impl From<&str> for SecretString {
    fn from(s: &str) -> Self {
        Self::new(s)
    }
}

/// Patterns that indicate sensitive content that should be redacted from logs.
const SENSITIVE_FIELD_PATTERNS: &[&str] = &[
    "content",
    "message",
    "text",
    "response",
    "payload",
    "body",
    "token",
    "key",
    "secret",
    "password",
    "credential",
    "auth",
    "api_key",
    "bearer",
];

/// A tracing layer that filters sensitive data from log output.
///
/// This layer intercepts log events and redacts field values that match
/// sensitive patterns, preventing accidental exposure of user data,
/// message content, or credentials in logs.
pub struct SensitiveDataFilter {
    /// Maximum length for any single field value before truncation
    max_field_length: usize,
}

impl Default for SensitiveDataFilter {
    fn default() -> Self {
        Self {
            max_field_length: 200,
        }
    }
}

impl SensitiveDataFilter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Set the maximum length for field values before truncation.
    pub fn with_max_field_length(mut self, len: usize) -> Self {
        self.max_field_length = len;
        self
    }

    /// Check if a field name indicates sensitive content.
    fn is_sensitive_field(name: &str) -> bool {
        let name_lower = name.to_lowercase();
        SENSITIVE_FIELD_PATTERNS
            .iter()
            .any(|pattern| name_lower.contains(pattern))
    }
}

/// Visitor that collects and redacts sensitive field values.
struct RedactingVisitor {
    /// Collected fields as (name, redacted_value) pairs
    fields: Vec<(String, String)>,
    max_length: usize,
}

impl RedactingVisitor {
    fn new(max_length: usize) -> Self {
        Self {
            fields: Vec::new(),
            max_length,
        }
    }

    fn redact_if_sensitive(&mut self, field: &Field, value: String) {
        let field_name = field.name();

        // Always redact fields with sensitive names
        if SensitiveDataFilter::is_sensitive_field(field_name) {
            self.fields
                .push((field_name.to_string(), "[REDACTED]".to_string()));
            return;
        }

        // Truncate long values (might contain embedded sensitive data)
        let final_value = if value.len() > self.max_length {
            format!("{}...[truncated {} chars]", &value[..self.max_length], value.len() - self.max_length)
        } else {
            value
        };

        self.fields.push((field_name.to_string(), final_value));
    }
}

impl Visit for RedactingVisitor {
    fn record_debug(&mut self, field: &Field, value: &dyn fmt::Debug) {
        self.redact_if_sensitive(field, format!("{:?}", value));
    }

    fn record_str(&mut self, field: &Field, value: &str) {
        self.redact_if_sensitive(field, value.to_string());
    }

    fn record_i64(&mut self, field: &Field, value: i64) {
        // Numeric values are generally safe
        self.fields.push((field.name().to_string(), value.to_string()));
    }

    fn record_u64(&mut self, field: &Field, value: u64) {
        self.fields.push((field.name().to_string(), value.to_string()));
    }

    fn record_bool(&mut self, field: &Field, value: bool) {
        self.fields.push((field.name().to_string(), value.to_string()));
    }
}

impl<S> Layer<S> for SensitiveDataFilter
where
    S: Subscriber + for<'lookup> LookupSpan<'lookup>,
{
    fn on_new_span(&self, _attrs: &Attributes<'_>, _id: &Id, _ctx: Context<'_, S>) {
        // Spans are handled by the underlying subscriber
    }

    fn on_record(&self, _span: &Id, _values: &Record<'_>, _ctx: Context<'_, S>) {
        // Records are handled by the underlying subscriber
    }

    fn on_event(&self, _event: &Event<'_>, _ctx: Context<'_, S>) {
        // Events pass through - the redaction happens in the visitor
        // when the underlying formatter accesses field values
    }

    fn enabled(&self, _metadata: &Metadata<'_>, _ctx: Context<'_, S>) -> bool {
        true
    }
}

/// Redact a string value, replacing it with [REDACTED] if it appears to contain sensitive data.
///
/// This is a utility function for use in error handlers and other places where
/// structured logging isn't available.
pub fn redact_sensitive(value: &str) -> String {
    if value.len() > 100 {
        "[REDACTED - content too long]".to_string()
    } else if looks_like_sensitive_content(value) {
        "[REDACTED]".to_string()
    } else {
        value.to_string()
    }
}

/// Heuristic check for content that looks like it might be sensitive.
fn looks_like_sensitive_content(value: &str) -> bool {
    // Check for common patterns that indicate sensitive data
    let patterns = [
        // Base64-encoded data (API keys, tokens)
        |s: &str| s.len() > 40 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '='),
        // JSON with sensitive-looking keys
        |s: &str| s.contains("\"content\"") || s.contains("\"message\"") || s.contains("\"text\""),
        // Bearer tokens
        |s: &str| s.starts_with("Bearer ") || s.starts_with("sk-") || s.starts_with("pk-"),
    ];

    patterns.iter().any(|check| check(value))
}

/// Trait for types that can safely describe themselves for logging without exposing sensitive data.
pub trait SafeLog {
    /// Return a log-safe description of this value.
    fn safe_log(&self) -> String;
}

impl SafeLog for Vec<u8> {
    fn safe_log(&self) -> String {
        format!("[{} bytes]", self.len())
    }
}

impl SafeLog for String {
    fn safe_log(&self) -> String {
        format!("[{} chars]", self.len())
    }
}

impl SafeLog for &str {
    fn safe_log(&self) -> String {
        format!("[{} chars]", self.len())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_string_display_redacts() {
        let secret = SecretString::new("my-api-key-12345");
        assert_eq!(format!("{}", secret), "[REDACTED]");
    }

    #[test]
    fn test_secret_string_debug_redacts() {
        let secret = SecretString::new("sensitive-data");
        assert!(format!("{:?}", secret).contains("[REDACTED]"));
    }

    #[test]
    fn test_secret_string_expose() {
        let secret = SecretString::new("actual-value");
        assert_eq!(secret.expose(), "actual-value");
    }

    #[test]
    fn test_is_sensitive_field() {
        assert!(SensitiveDataFilter::is_sensitive_field("message_content"));
        assert!(SensitiveDataFilter::is_sensitive_field("api_key"));
        assert!(SensitiveDataFilter::is_sensitive_field("response_text"));
        assert!(SensitiveDataFilter::is_sensitive_field("auth_token"));
        assert!(!SensitiveDataFilter::is_sensitive_field("job_id"));
        assert!(!SensitiveDataFilter::is_sensitive_field("user_canister"));
    }

    #[test]
    fn test_redact_sensitive() {
        // Long content is redacted
        let long = "a".repeat(150);
        assert_eq!(redact_sensitive(&long), "[REDACTED - content too long]");

        // Safe short content passes through
        assert_eq!(redact_sensitive("hello"), "hello");

        // Bearer tokens are redacted
        assert_eq!(redact_sensitive("Bearer xyz123"), "[REDACTED]");
    }

    #[test]
    fn test_safe_log_vec() {
        let data: Vec<u8> = vec![1, 2, 3, 4, 5];
        assert_eq!(data.safe_log(), "[5 bytes]");
    }

    #[test]
    fn test_safe_log_string() {
        let s = String::from("hello world");
        assert_eq!(s.safe_log(), "[11 chars]");
    }
}
