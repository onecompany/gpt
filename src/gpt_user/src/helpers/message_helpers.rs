use crate::{
    config::{ALLOWED_IMAGE_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES},
    storage::{StorableString, CHAT_JOBS, CHATS, MESSAGES, MODELS},
};
use gpt_types::{
    domain::{Message, ModelId, message::ImageAttachment},
    error::{CanisterError, CanisterResult},
};

pub fn is_chat_in_generation(chat_id: u64) -> CanisterResult<bool> {
    let active = CHATS.with(|c| {
        c.borrow()
            .get(&chat_id)
            .and_then(|w| w.0.active_job_id)
    });
    Ok(active.is_some())
}

pub fn validate_attachments(
    attachments: &Option<Vec<ImageAttachment>>,
    model_id: &ModelId,
) -> CanisterResult<()> {
    if let Some(atts) = attachments {
        let model = MODELS
            .with(|m| m.borrow().get(&StorableString(model_id.clone())).map(|w| w.0.clone()))
            .ok_or(CanisterError::ModelNotFound)?;

        if atts.len() as u32 > model.max_image_attachments {
            return Err(CanisterError::InvalidInput(format!(
                "Number of attachments ({}) exceeds the model's limit of {}.",
                atts.len(),
                model.max_image_attachments
            )));
        }

        validate_attachment_properties(attachments)?;
    }
    Ok(())
}

pub fn find_model_id_for_message(user_message: &Message) -> CanisterResult<ModelId> {
    // Find child AI message and its associated job
    if let Some(model_id) = MESSAGES.with(|m| {
        let messages = m.borrow();
        let mut child_ai_msg_id = None;

        for entry in messages.iter() {
            let msg = &entry.value().0;
            if msg.parent_message_id == Some(user_message.message_id) {
                child_ai_msg_id = Some(msg.message_id);
                break;
            }
        }

        child_ai_msg_id.and_then(|ai_msg_id| {
            CHAT_JOBS.with(|cj| {
                let jobs = cj.borrow();
                for entry in jobs.iter() {
                    let job = &entry.value().0;
                    if job.placeholder_message_id == ai_msg_id {
                        return Some(job.model_id.clone());
                    }
                }
                None
            })
        })
    }) {
        return Ok(model_id);
    }

    // Fallback: find most recent job for this chat
    if let Some(model_id) = CHAT_JOBS.with(|cj| {
        let jobs = cj.borrow();
        let mut best: Option<(u64, String)> = None;

        for entry in jobs.iter() {
            let job = &entry.value().0;
            if job.chat_id == user_message.chat_id {
                match &best {
                    None => best = Some((job.created_at, job.model_id.clone())),
                    Some((best_time, _)) if job.created_at > *best_time => {
                        best = Some((job.created_at, job.model_id.clone()))
                    }
                    _ => {}
                }
            }
        }

        best.map(|(_, model_id)| model_id)
    }) {
        return Ok(model_id);
    }

    Err(CanisterError::ModelNotFound)
}

fn validate_attachment_properties(
    attachments: &Option<Vec<ImageAttachment>>,
) -> CanisterResult<()> {
    if let Some(atts) = attachments {
        let total_size: usize = atts.iter().map(|a| a.data.len()).sum();
        if total_size > MAX_ATTACHMENT_SIZE_BYTES {
            return Err(CanisterError::FileSystemLimitExceeded(format!(
                "Total attachment size {} exceeds limit of {} bytes.",
                total_size, MAX_ATTACHMENT_SIZE_BYTES
            )));
        }

        for att in atts {
            if !ALLOWED_IMAGE_MIME_TYPES.contains(&att.mime_type.as_str()) {
                return Err(CanisterError::UnsupportedMimeType(att.mime_type.clone()));
            }
        }
    }
    Ok(())
}
