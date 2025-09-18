import React, { useEffect } from 'react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ isOpen, onClose, imageUrl }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
  
  // Conditional rendering `if (!isOpen) return null;` is removed to allow for CSS exit transitions.
  // Visibility is now controlled by CSS classes.

  return (
    <div 
      className={`fixed inset-0 bg-black/75 z-[100] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`
      }
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-hidden={!isOpen}
    >
      <div 
        className={`relative max-w-4xl w-full max-h-[90vh] bg-white p-2 rounded-lg shadow-xl transition-all duration-300 ease-in-out
          ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`
        }
        onClick={e => e.stopPropagation()} // Prevent closing when clicking on the image/container
      >
        {imageUrl && (
            <img 
                src={imageUrl} 
                alt="レシートプレビュー" 
                className="w-full h-full object-contain"
            />
        )}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 h-8 w-8 bg-gray-800 text-white rounded-full flex items-center justify-center leading-none hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          aria-label="閉じる"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ImagePreviewModal;