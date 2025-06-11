// src/components/BookCard.jsx
import React from "react";

export default function BookCard({ book, onSelect }) {
  return (
    <div className="book-card" onClick={() => onSelect(book)} role="button" tabIndex={0} onKeyPress={() => onSelect(book)}>
      <img src={book.thumbnail || "https://via.placeholder.com/150x220?text=No+Image"} alt={book.title} className="book-thumbnail" loading="lazy" />
      <div className="book-info">
        <h3 className="book-title">{book.title}</h3>
        <p className="book-authors">by {book.authors}</p>
        <p className="book-description">{book.description}</p>
        <p className="book-score">Score: {book.score}</p>
      </div>
    </div>
  );
}
