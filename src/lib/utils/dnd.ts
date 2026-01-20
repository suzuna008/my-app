// Smooth drag and drop utility for Svelte using pointer events
export interface DragDropOptions {
    onDrop: (fromIndex: number, toIndex: number) => void;
    disabled?: boolean;
    handle?: string; // CSS selector for drag handle (optional)
}

export function dragDrop(node: HTMLElement, options: DragDropOptions) {
    let draggedElement: HTMLElement | null = null;
    let draggedIndex: number = -1;
    let ghostElement: HTMLElement | null = null;
    let placeholder: HTMLElement | null = null;
    let startY: number = 0;
    let startX: number = 0;
    let currentY: number = 0;
    let currentX: number = 0;
    let offsetY: number = 0;
    let offsetX: number = 0;
    let isDragging: boolean = false;
    let animationFrameId: number | null = null;
    let hasMoved: boolean = false;
    let pendingDrag: { item: HTMLElement; startY: number; startX: number; offsetY: number; offsetX: number } | null = null;
    let isHorizontalLayout: boolean = false;
    
    function getDraggableItems(): HTMLElement[] {
        return Array.from(node.children).filter(
            child => (child as HTMLElement).hasAttribute('data-draggable')
        ) as HTMLElement[];
    }
    
    function createGhost(element: HTMLElement): HTMLElement {
        const rect = element.getBoundingClientRect();
        const ghost = element.cloneNode(true) as HTMLElement;
        
        ghost.style.position = 'fixed';
        ghost.style.top = `${rect.top}px`;
        ghost.style.left = `${rect.left}px`;
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.opacity = '0.85';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '10000';
        ghost.style.transform = 'rotate(2deg) scale(1.05)';
        ghost.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.3)';
        ghost.style.transition = 'none';
        ghost.style.cursor = 'grabbing';
        ghost.style.willChange = 'transform';
        ghost.style.backfaceVisibility = 'hidden';
        
        // Remove any interactive elements from ghost
        ghost.querySelectorAll('button, input, select, textarea').forEach(el => {
            (el as HTMLElement).style.pointerEvents = 'none';
        });
        
        document.body.appendChild(ghost);
        return ghost;
    }
    
    function createPlaceholder(element: HTMLElement): HTMLElement {
        const rect = element.getBoundingClientRect();
        const parentStyle = window.getComputedStyle(element.parentElement || node);
        const elementStyle = window.getComputedStyle(element);
        const isFlexWrap = parentStyle.flexWrap !== 'nowrap' || parentStyle.display === 'flex';
        const isHorizontal = parentStyle.flexDirection === 'row' || parentStyle.flexDirection === 'row-reverse';
        
        const placeholder = document.createElement('div');
        placeholder.style.height = `${rect.height}px`;
        
        // For flex-wrap layouts (like tags), use the element's width
        if (isFlexWrap && isHorizontal) {
            placeholder.style.width = `${rect.width}px`;
            placeholder.style.minWidth = `${rect.width}px`;
            placeholder.style.flexShrink = '0';
            placeholder.style.display = 'inline-block';
            // Copy margin from element
            placeholder.style.margin = elementStyle.margin || '0';
        } else {
            placeholder.style.width = '100%';
            placeholder.style.display = 'block';
            placeholder.style.margin = '0';
        }
        
        placeholder.style.backgroundColor = 'rgba(88, 129, 87, 0.1)';
        placeholder.style.border = '2px dashed #588157';
        placeholder.style.borderRadius = elementStyle.borderRadius || '6px';
        placeholder.style.transition = 'all 0.2s ease';
        placeholder.style.pointerEvents = 'none';
        placeholder.setAttribute('data-placeholder', 'true');
        return placeholder;
    }
    
    function getElementUnderPoint(x: number, y: number): HTMLElement | null {
        // Temporarily hide ghost to get element underneath
        if (ghostElement) {
            ghostElement.style.display = 'none';
        }
        const element = document.elementFromPoint(x, y) as HTMLElement;
        if (ghostElement) {
            ghostElement.style.display = '';
        }
        return element?.closest('[data-draggable]') as HTMLElement || null;
    }
    
    function updateDragPosition(x: number, y: number) {
        if (!ghostElement || !draggedElement || !placeholder) return;
        
        currentY = y;
        currentX = x;
        const newTop = currentY - offsetY;
        const newLeft = currentX - offsetX;
        ghostElement.style.top = `${newTop}px`;
        ghostElement.style.left = `${newLeft}px`;
        
        // Detect layout type
        const computedStyle = window.getComputedStyle(node);
        const isFlexWrap = computedStyle.flexWrap !== 'nowrap' || computedStyle.display === 'flex';
        const isHorizontal = computedStyle.flexDirection === 'row' || computedStyle.flexDirection === 'row-reverse';
        isHorizontalLayout = isFlexWrap && isHorizontal;
        
        // Find the element we're hovering over
        const hoveredElement = getElementUnderPoint(x, y);
        
        if (hoveredElement && hoveredElement !== draggedElement && hoveredElement !== placeholder) {
            const items = getDraggableItems();
            const hoveredIndex = items.indexOf(hoveredElement);
            const currentDraggedIndex = items.indexOf(draggedElement);
            
            if (hoveredIndex !== -1 && currentDraggedIndex !== -1 && hoveredIndex !== currentDraggedIndex) {
                const hoveredRect = hoveredElement.getBoundingClientRect();
                
                // Determine insertion point based on layout
                let insertBefore: HTMLElement | null = null;
                
                if (isHorizontalLayout) {
                    // Horizontal layout: use X position
                    const hoveredMiddle = hoveredRect.left + hoveredRect.width / 2;
                    if (x < hoveredMiddle) {
                        insertBefore = hoveredElement;
                    } else {
                        insertBefore = hoveredElement.nextSibling as HTMLElement;
                    }
                } else {
                    // Vertical layout: use Y position
                    const hoveredMiddle = hoveredRect.top + hoveredRect.height / 2;
                    if (y < hoveredMiddle) {
                        insertBefore = hoveredElement;
                    } else {
                        insertBefore = hoveredElement.nextSibling as HTMLElement;
                    }
                }
                
                // Move dragged element
                if (insertBefore && insertBefore !== draggedElement) {
                    draggedElement.parentElement?.insertBefore(draggedElement, insertBefore);
                } else if (!insertBefore) {
                    // Insert at end
                    draggedElement.parentElement?.appendChild(draggedElement);
                }
                
                // Update placeholder position - always right after dragged element
                if (placeholder.parentElement && draggedElement.nextSibling !== placeholder) {
                    draggedElement.parentElement?.insertBefore(placeholder, draggedElement.nextSibling);
                }
            }
        } else if (!hoveredElement) {
            // Check if we're at the edges of the list
            const items = getDraggableItems();
            if (items.length > 0) {
                const firstItem = items[0];
                const lastItem = items[items.length - 1];
                const firstRect = firstItem.getBoundingClientRect();
                const lastRect = lastItem.getBoundingClientRect();
                
                if (isHorizontalLayout) {
                    // Horizontal: check left/right
                    if (x < firstRect.left) {
                        firstItem.parentElement?.insertBefore(draggedElement, firstItem);
                        draggedElement.parentElement?.insertBefore(placeholder, draggedElement.nextSibling);
                    } else if (x > lastRect.right) {
                        lastItem.parentElement?.appendChild(draggedElement);
                        draggedElement.parentElement?.insertBefore(placeholder, draggedElement.nextSibling);
                    }
                } else {
                    // Vertical: check top/bottom
                    if (y < firstRect.top) {
                        firstItem.parentElement?.insertBefore(draggedElement, firstItem);
                        draggedElement.parentElement?.insertBefore(placeholder, draggedElement.nextSibling);
                    } else if (y > lastRect.bottom) {
                        lastItem.parentElement?.appendChild(draggedElement);
                        draggedElement.parentElement?.insertBefore(placeholder, draggedElement.nextSibling);
                    }
                }
            }
        }
    }
    
    function handlePointerDown(e: PointerEvent) {
        if (options.disabled || isDragging) return;
        
        const target = e.target as HTMLElement;
        
        // Prevent dragging if clicking directly on interactive elements
        const interactiveElement = target.closest('button, input, select, textarea, a, [role="button"]');
        if (interactiveElement && interactiveElement !== target.closest('[data-draggable]')) {
            return;
        }
        
        // Check if clicking on handle (if specified)
        if (options.handle) {
            const handle = target.closest(options.handle);
            if (!handle) return;
        }
        
        const item = target.closest('[data-draggable]') as HTMLElement;
        if (!item) return;
        
        // Detect if this is a touch device
        const isTouch = e.pointerType === 'touch' || ('ontouchstart' in window);
        
        // Check if parent container is scrollable
        const parentContainer = item.closest('.categories-list, .spots-list, .tags-list, .tags-list-modal');
        const isScrollable = parentContainer ? 
            (parentContainer.scrollHeight > parentContainer.clientHeight || 
             parentContainer.scrollWidth > parentContainer.clientWidth) : false;
        
        const rect = item.getBoundingClientRect();
        startY = e.clientY;
        startX = e.clientX;
        offsetY = e.clientY - rect.top;
        offsetX = e.clientX - rect.left;
        hasMoved = false;
        
        // Store pending drag info
        pendingDrag = { item, startY: e.clientY, startX: e.clientX, offsetY, offsetX };
        
        // Track movement - only start drag after threshold
        // Use higher threshold for touch devices, especially if container is scrollable
        const dragThreshold = isTouch ? (isScrollable ? 30 : 20) : 8;
        let startTime = Date.now();
        
        const handleMove = (moveEvent: PointerEvent) => {
            if (!pendingDrag) return;
            
            const moveDistanceY = Math.abs(moveEvent.clientY - pendingDrag.startY);
            const moveDistanceX = Math.abs(moveEvent.clientX - pendingDrag.startX);
            const moveDistance = Math.max(moveDistanceY, moveDistanceX);
            const elapsedTime = Date.now() - startTime;
            
            // For touch devices with scrollable containers, prioritize scrolling
            if (isTouch && isScrollable) {
                // If movement is primarily vertical (scrolling), don't start drag
                if (moveDistanceY > moveDistanceX * 1.5) {
                    // User is scrolling, cancel drag
                    pendingDrag = null;
                    document.removeEventListener('pointermove', handleMove);
                    document.removeEventListener('pointerup', handleUp);
                    return;
                }
                
                // Require more horizontal movement and/or time before starting drag
                if (moveDistance < dragThreshold || (moveDistance < dragThreshold * 0.7 && elapsedTime < 200)) {
                    return;
                }
            } else {
                // For mouse or non-scrollable containers, use normal threshold
                if (moveDistance < dragThreshold) {
                    return;
                }
            }
            
            // Start drag only if we've moved enough
            hasMoved = true;
            startDrag(pendingDrag.item, moveEvent);
            pendingDrag = null;
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
        };
        
        const handleUp = () => {
            pendingDrag = null;
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
        };
        
        // Use passive listener initially to allow scrolling
        // We'll remove it and add a non-passive one when drag actually starts
        document.addEventListener('pointermove', handleMove, { passive: true });
        document.addEventListener('pointerup', handleUp);
    }
    
    function startDrag(item: HTMLElement, e: PointerEvent) {
        if (isDragging) return;
        
        // Only prevent default when we're actually starting to drag
        // This allows normal scrolling to work
        e.preventDefault();
        e.stopPropagation();
        
        isDragging = true;
        draggedElement = item;
        
        const items = getDraggableItems();
        draggedIndex = items.indexOf(item);
        
        if (draggedIndex === -1) {
            isDragging = false;
            draggedElement = null;
            return;
        }
        
        // Create ghost and placeholder
        ghostElement = createGhost(item);
        placeholder = createPlaceholder(item);
        
        // Insert placeholder right after the dragged element
        item.parentElement?.insertBefore(placeholder, item.nextSibling);
        
        // Style dragged element
        item.style.opacity = '0.3';
        item.style.transition = 'none';
        item.style.pointerEvents = 'none';
        
        // Add dragging class for CSS
        item.classList.add('dragging');
        
        // Set pointer capture for smooth tracking
        item.setPointerCapture(e.pointerId);
        
        // Add global listeners
        document.addEventListener('pointermove', handlePointerMove);
        document.addEventListener('pointerup', handlePointerUp);
        document.addEventListener('pointercancel', handlePointerUp);
        
        // Prevent text selection
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    }
    
    function handlePointerMove(e: PointerEvent) {
        if (!isDragging || !draggedElement) return;
        
        // Only prevent default when actually dragging
        e.preventDefault();
        e.stopPropagation();
        
        // Use requestAnimationFrame for smooth updates
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // Throttle updates for smoother performance
        animationFrameId = requestAnimationFrame(() => {
            updateDragPosition(e.clientX, e.clientY);
            animationFrameId = null;
        });
    }
    
    function handlePointerUp(e: PointerEvent) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        // Release pointer capture
        if (draggedElement) {
            draggedElement.releasePointerCapture(e.pointerId);
        }
        
        // Get final position
        const items = getDraggableItems();
        const finalIndex = draggedElement ? items.indexOf(draggedElement) : -1;
        
        // Call onDrop if position changed
        if (draggedElement && finalIndex !== -1 && finalIndex !== draggedIndex) {
            options.onDrop(draggedIndex, finalIndex);
        }
        
        // Cleanup
        cleanup();
        
        // Remove global listeners
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
        document.removeEventListener('pointercancel', handlePointerUp);
        
        // Restore text selection
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }
    
    function cleanup() {
        pendingDrag = null;
        
        if (ghostElement) {
            ghostElement.remove();
            ghostElement = null;
        }
        
        if (placeholder) {
            placeholder.remove();
            placeholder = null;
        }
        
        if (draggedElement) {
            draggedElement.style.opacity = '';
            draggedElement.style.transition = '';
            draggedElement.style.pointerEvents = '';
            draggedElement.classList.remove('dragging');
            draggedElement = null;
        }
        
        isDragging = false;
        draggedIndex = -1;
        hasMoved = false;
    }
    
    // Setup listeners on draggable items
    function setupListeners() {
        const items = getDraggableItems();
        items.forEach(item => {
            item.style.cursor = 'grab';
            item.style.userSelect = 'none';
            item.addEventListener('pointerdown', handlePointerDown);
        });
    }
    
    // Initial setup
    setupListeners();
    
    // Watch for new draggable items
    const observer = new MutationObserver(() => {
        if (!isDragging) {
            setupListeners();
        }
    });
    
    observer.observe(node, { childList: true, subtree: true });
    
    return {
        update(newOptions: DragDropOptions) {
            options = newOptions;
            if (newOptions.disabled && isDragging) {
                cleanup();
            }
        },
        destroy() {
            observer.disconnect();
            cleanup();
            const items = getDraggableItems();
            items.forEach(item => {
                item.removeEventListener('pointerdown', handlePointerDown);
            });
            document.removeEventListener('pointermove', handlePointerMove);
            document.removeEventListener('pointerup', handlePointerUp);
            document.removeEventListener('pointercancel', handlePointerUp);
        }
    };
}
