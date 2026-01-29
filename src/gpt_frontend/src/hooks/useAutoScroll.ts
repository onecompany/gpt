import { useRef, useState, useEffect, useCallback } from "react";

export const useAutoScroll = (scrollDependency: unknown) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const userHasScrolledRef = useRef(false);
  const anchorElementRef = useRef<{
    element: Element;
    offsetFromTop: number;
  } | null>(null);
  const isAdjustingScrollRef = useRef(false);
  const adjustmentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTopRef = useRef(0);
  const scrollDirectionRef = useRef<"up" | "down" | null>(null);
  const userScrollIntentRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const container = scrollContainerRef.current;
    if (container) {
      isAdjustingScrollRef.current = true;
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
      userHasScrolledRef.current = false;
      userScrollIntentRef.current = false;
      anchorElementRef.current = null;
      setIsUserScrolledUp(false);
      setHasUnread(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isAdjustingScrollRef.current = false;
        });
      });
    }
  }, []);

  const findAnchorElement = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return null;

    const messages = container.querySelectorAll(".message");
    if (messages.length === 0) return null;

    const containerRect = container.getBoundingClientRect();
    for (const message of messages) {
      const rect = message.getBoundingClientRect();
      if (
        rect.top >= containerRect.top &&
        rect.bottom <= containerRect.bottom
      ) {
        return {
          element: message,
          offsetFromTop: rect.top - containerRect.top,
        };
      }
    }

    for (const message of messages) {
      const rect = message.getBoundingClientRect();
      if (rect.bottom > containerRect.top) {
        return {
          element: message,
          offsetFromTop: rect.top - containerRect.top,
        };
      }
    }

    return null;
  }, []);

  const maintainScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (
      !container ||
      !userHasScrolledRef.current ||
      !anchorElementRef.current
    ) {
      return;
    }

    isAdjustingScrollRef.current = true;

    try {
      const { element, offsetFromTop } = anchorElementRef.current;

      if (!container.contains(element)) {
        anchorElementRef.current = findAnchorElement();
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const currentOffsetFromTop = elementRect.top - containerRect.top;
      const scrollAdjustment = currentOffsetFromTop - offsetFromTop;

      if (Math.abs(scrollAdjustment) > 1) {
        container.scrollTop += scrollAdjustment;
      }
    } finally {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          isAdjustingScrollRef.current = false;
        });
      });
    }
  }, [findAnchorElement]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      if (userHasScrolledRef.current || userScrollIntentRef.current) {
        if (adjustmentTimeoutRef.current) {
          clearTimeout(adjustmentTimeoutRef.current);
        }

        adjustmentTimeoutRef.current = setTimeout(() => {
          maintainScrollPosition();
        }, 16);
      } else if (!userHasScrolledRef.current && !userScrollIntentRef.current) {
        requestAnimationFrame(() => {
          if (!userHasScrolledRef.current && !userScrollIntentRef.current) {
            scrollToBottom("auto");
          }
        });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: false,
    });

    return () => {
      observer.disconnect();
      if (adjustmentTimeoutRef.current) {
        clearTimeout(adjustmentTimeoutRef.current);
      }
    };
  }, [maintainScrollPosition, scrollToBottom]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    lastScrollTopRef.current = container.scrollTop;

    let scrollTimeout: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (isAdjustingScrollRef.current) return;

      const currentScrollTop = container.scrollTop;
      const scrollDelta = currentScrollTop - lastScrollTopRef.current;
      const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        20;

      if (Math.abs(scrollDelta) > 2) {
        scrollDirectionRef.current = scrollDelta < 0 ? "up" : "down";

        if (scrollDelta < -5 && !userScrollIntentRef.current) {
          userScrollIntentRef.current = true;
        }
      }

      lastScrollTopRef.current = currentScrollTop;

      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      if (isAtBottom) {
        scrollTimeout = setTimeout(() => {
          if (userHasScrolledRef.current || userScrollIntentRef.current) {
            userHasScrolledRef.current = false;
            userScrollIntentRef.current = false;
            anchorElementRef.current = null;
            setIsUserScrolledUp(false);
            setHasUnread(false);
          }
        }, 100);
      } else {
        if (!userHasScrolledRef.current || userScrollIntentRef.current) {
          userHasScrolledRef.current = true;
          userScrollIntentRef.current = false;
          setIsUserScrolledUp(true);
          anchorElementRef.current = findAnchorElement();
        } else {
          const newAnchor = findAnchorElement();
          if (newAnchor) {
            anchorElementRef.current = newAnchor;
          }
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && !userScrollIntentRef.current) {
        userScrollIntentRef.current = true;
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!userHasScrolledRef.current && !userScrollIntentRef.current) {
        scrollToBottom("auto");
      }
    });
    resizeObserver.observe(container);

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("wheel", handleWheel);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [scrollToBottom, findAnchorElement]);

  useEffect(() => {
    if (userHasScrolledRef.current || userScrollIntentRef.current) {
      setHasUnread(true);
    } else {
      scrollToBottom("auto");
    }
  }, [scrollDependency, scrollToBottom]);

  return {
    scrollContainerRef,
    sentinelRef,
    isUserScrolledUp,
    hasUnread,
    scrollToBottom,
  };
};
