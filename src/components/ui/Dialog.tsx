import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: number;
}

export function Dialog({ open, onOpenChange, title, children, maxWidth = 440 }: DialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="dialog-backdrop"
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                className="dialog-content"
                style={{ maxWidth }}
              >
                <div className="dialog-header">
                  {title && (
                    <DialogPrimitive.Title className="dialog-title">
                      {title}
                    </DialogPrimitive.Title>
                  )}
                  <DialogPrimitive.Close asChild>
                    <button className="dialog-close-btn" aria-label="Close dialog">
                      <X size={16} />
                    </button>
                  </DialogPrimitive.Close>
                </div>
                <div className="dialog-body">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </AnimatePresence>
  );
}
