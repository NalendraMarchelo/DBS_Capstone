import { useState, useEffect, useRef } from "react";

export function SearchAutocomplete({ value, onChange, onSubmit, onSuggestionClick, className = "", ariaLabel = "Search books", spellCheck = false }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceTimeout = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      setActiveIndex(-1);
      return;
    }

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      const baseUrl = `${window.location.protocol}//${window.location.hostname}:5000`;

      fetch(`${baseUrl}/api/suggestions?query=${encodeURIComponent(value)}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch suggestions");
          return res.json();
        })
        .then((data) => {
          if (data.results?.length > 0) {
            setSuggestions(data.results);
            setShowDropdown(true);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
          setActiveIndex(-1);
        })
        .catch((error) => {
          console.error("Fetch suggestions error:", error);
          setSuggestions([]);
          setShowDropdown(false);
          setActiveIndex(-1);
        });
    }, 300);

    return () => clearTimeout(debounceTimeout.current);
  }, [value]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case "Enter":
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          // Ketika Enter ditekan pada saran yang aktif, panggil handleSelectSuggestion
          handleSelectSuggestion(suggestions[activeIndex]);
        } else {
          // Jika tidak ada saran yang aktif, atau Enter ditekan di input tanpa memilih saran
          onSubmit(); // Lakukan pencarian biasa
          setShowDropdown(false); // Sembunyikan dropdown
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;
      case "Escape":
        setShowDropdown(false);
        break;
      default:
        break;
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    onChange(suggestion.title); // Update input field
    setShowDropdown(false); // Sembunyikan dropdown
    // --- Panggil prop onSuggestionClick yang baru dari parent ---
    if (onSuggestionClick) {
      onSuggestionClick(suggestion.title); // Kirim judul saran yang diklik ke App.jsx
    }
    // --- Akhir Pemanggilan Prop ---
  };

  return (
    <div className="autocomplete-container" ref={containerRef}>
      <input
        type="text"
        placeholder="Search books..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        // Gunakan onBlur dengan timeout untuk memungkinkan klik pada saran
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        className={`autocomplete-input ${className}`.trim()}
        autoComplete="off"
        spellCheck={spellCheck}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={showDropdown}
      />

      {showDropdown && (
        <ul className="autocomplete-list" role="listbox">
          {suggestions.map((item, idx) => (
            <li
              key={`${item.title}-${idx}`}
              role="option"
              aria-selected={activeIndex === idx}
              className={`autocomplete-item ${activeIndex === idx ? "active" : ""}`}
              onMouseDown={() => handleSelectSuggestion(item)} // Gunakan onMouseDown
              onMouseEnter={() => setActiveIndex(idx)}
            >
              {item.title} ({item.published_year || "N/A"})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
