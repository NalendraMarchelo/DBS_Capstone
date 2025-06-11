// src/components/BookModal.jsx
import React from "react";

export default function BookModal({ book, onClose }) {
  if (!book) return null;

  const { thumbnail, title, published_year, categories, num_pages, description, authors, average_rating } = book;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-minimalist" onClick={onClose} aria-label="Close modal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-hero">
          <img src={thumbnail || "https://via.placeholder.com/800x450?text=No+Image"} alt={title} className="modal-hero-image" loading="lazy" />
        </div>

        <div className="modal-details">
          <h2 className="modal-title">{title}</h2>
          <div className="modal-meta">
            <span className="modal-year">{published_year}</span>
            <span className="modal-genres">{Array.isArray(categories) ? categories.join(", ") : categories}</span>
            <span className="modal-duration">{num_pages} pages</span>
          </div>
          <div className="modal-actions">
            <button className="modal-play-button">
              <span>▶</span> Read Now
            </button>
            <button className="modal-watchlist-button">+ Add to Wishlist</button>
          </div>
          <p className="modal-description">{description}</p>
          <div className="modal-cast">
            <p>
              <strong>Authors:</strong> {authors}
            </p>
            <p>
              <strong>Rating:</strong> ⭐ {average_rating}/5
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
