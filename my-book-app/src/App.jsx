import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import "./App.css";
import BookCard from "./components/BookCard.jsx"; // Ditambahkan .jsx
import BookModal from "./components/BookModal.jsx"; // Ditambahkan .jsx
import { SearchAutocomplete } from "./components/SearchAutoComplete.jsx"; // Ditambahkan .jsx

export default function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState([]); // Hasil pencarian utama
  const [fallbackBooks, setFallbackBooks] = useState([]); // Rekomendasi fallback ketika no match
  const [defaultBooks, setDefaultBooks] = useState([]); // Rekomendasi awal saat belum cari apa-apa
  const [selectedBook, setSelectedBook] = useState(null);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false); // Untuk menampilkan "Instead, you may be interested in:"
  const [isLoading, setIsLoading] = useState(false);
  const [activeGenres, setActiveGenres] = useState(new Set()); // Inisialisasi Set di sini

  // --- State untuk Mengelola Hasil Klik Saran Autocomplete ---
  const [isSuggestionResult, setIsSuggestionResult] = useState(false); // Flag jika hasil yang ditampilkan berasal dari klik saran
  const [clickedSuggestionBook, setClickedSuggestionBook] = useState(null); // Menyimpan detail buku yang diklik dari saran
  // --- Akhir State Terkait Saran ---

  // Load defaultBooks dari backend atau localStorage saat pertama kali load
  useEffect(() => {
    async function fetchDefault() {
      try {
        // Menggunakan template literal untuk URL
        const response = await fetch(`${window.location.protocol}//${window.location.hostname}:5000/api/default`);
        if (!response.ok) throw new Error("Failed to fetch default books");
        const data = await response.json();
        setDefaultBooks(data.results || []);
      } catch (e) {
        console.warn("Could not load default books:", e);
        setDefaultBooks([]); // fallback kosong
      }
    }

    fetchDefault();
  }, []);

  // Simpan dan load hasil pencarian (optional, bisa tetap kamu pakai)
  // Logic localStorage ini tidak akan mengganggu filter genre, jadi biarkan saja
  useEffect(() => {
    const hasSearched = localStorage.getItem("hasSearched");
    if (hasSearched === "true") {
      const savedBooks = localStorage.getItem("books");
      if (savedBooks) {
        setBooks(JSON.parse(savedBooks));
      }
    }
  }, []);

  useEffect(() => {
    if (books.length > 0) {
      localStorage.setItem("books", JSON.stringify(books));
    } else {
      localStorage.removeItem("books");
    }
  }, [books]);

  useEffect(() => {
    const savedBook = localStorage.getItem("selectedBook");
    if (savedBook) {
      setSelectedBook(JSON.parse(savedBook));
    }
  }, []);

  useEffect(() => {
    if (selectedBook) {
      localStorage.setItem("selectedBook", JSON.stringify(selectedBook));
    } else {
      localStorage.removeItem("selectedBook");
    }
  }, [selectedBook]);

  useEffect(() => {
    const savedQuery = localStorage.getItem("lastQuery");
    if (savedQuery) {
      setSearchQuery(savedQuery);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    const trimmedQuery = searchQuery.trim();

    // Reset semua state terkait tampilan sebelum pencarian baru
    setError("");
    setBooks([]);
    setFallbackBooks([]);
    setShowSuggestions(false);
    setActiveGenres(new Set()); // Reset genre aktif saat pencarian baru
    setIsSuggestionResult(false); // Reset flag ini
    setClickedSuggestionBook(null); // Reset buku saran yang diklik

    if (!trimmedQuery) {
      return; // Langsung kembali jika query kosong, tanpa melakukan pencarian
    }

    // Pencegahan pencarian ulang jika sedang menampilkan hasil saran yang sama persis
    if (isSuggestionResult && clickedSuggestionBook && clickedSuggestionBook.title.toLowerCase() === trimmedQuery.toLowerCase()) {
      setIsLoading(false); // Pastikan isLoading false jika tidak melakukan pencarian
      return;
    }

    setIsLoading(true);

    try {
      // Menggunakan template literal untuk URL
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:5000/api/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmedQuery }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

      const data = await response.json();

      localStorage.removeItem("books"); // Selalu hapus cache buku lama

      const noMatch = data.message?.toLowerCase().includes("no match");

      if (noMatch) {
        setError(data.message || "No results found for your query.");
        setBooks([]); // Pastikan books utama kosong
        setFallbackBooks(data.results || []); // Set fallback books
        setShowSuggestions(true); // Tampilkan pesan saran
      } else {
        setError(""); // Hapus error jika ada hasil
        setBooks(data.results || []); // Set hasil pencarian utama
        setFallbackBooks([]); // Kosongkan fallback
        setShowSuggestions(false); // Sembunyikan pesan saran
      }

      localStorage.setItem("hasSearched", "true");
      localStorage.setItem("lastQuery", trimmedQuery);
    } catch (err) {
      setError("Failed to fetch recommendations. Please try again later.");
      setBooks([]);
      setFallbackBooks([]);
      setShowSuggestions(false);
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, isSuggestionResult, clickedSuggestionBook]); // Tambahkan dependensi

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleGoHome = useCallback(() => {
    // Gunakan useCallback
    setSearchQuery("");
    setBooks([]);
    setFallbackBooks([]);
    setError("");
    setSelectedBook(null);
    setShowSuggestions(false);
    setActiveGenres(new Set()); // Reset genre aktif saat home
    setIsSuggestionResult(false); // Reset flag ini
    setClickedSuggestionBook(null); // Reset buku saran yang diklik
    localStorage.removeItem("books");
    localStorage.removeItem("hasSearched");
    localStorage.removeItem("lastQuery");
  }, []); // Dependensi kosong karena tidak bergantung pada state lain yang berubah

  // --- Fungsi untuk Menangani Klik Saran Autocomplete ---
  const handleSuggestionClick = useCallback(async (suggestionTitle) => {
    setSearchQuery(suggestionTitle); // Perbarui input search dengan judul saran yang diklik
    setIsLoading(true);
    setError("");
    setBooks([]); // Kosongkan hasil pencarian utama
    setFallbackBooks([]); // Kosongkan fallback
    setShowSuggestions(false); // Sembunyikan pesan saran umum
    setActiveGenres(new Set()); // Reset genre aktif
    setIsSuggestionResult(true); // Set flag bahwa ini adalah hasil dari klik saran
    setClickedSuggestionBook(null); // Reset sementara sampai buku yang tepat ditemukan

    try {
      // Panggil API recommend untuk mendapatkan detail buku lengkap
      // Menggunakan template literal untuk URL
      const response = await fetch(`${window.location.protocol}//${window.location.hostname}:5000/api/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: suggestionTitle }),
      });

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        // Cari buku yang judulnya persis sama dari hasil rekomendasi
        const exactMatchBook = data.results.find((book) => book.title.toLowerCase() === suggestionTitle.toLowerCase());

        if (exactMatchBook) {
          setClickedSuggestionBook(exactMatchBook); // Simpan buku yang diklik
          setError(""); // Hapus error jika ada
        } else {
          // Jika tidak ada match persis, tampilkan pesan error
          setClickedSuggestionBook(null);
          setError("Exact book not found among recommendations for this title.");
        }
      } else {
        setClickedSuggestionBook(null);
        setError("No recommendations found for this title.");
      }

      localStorage.setItem("hasSearched", "true");
      localStorage.setItem("lastQuery", suggestionTitle);
    } catch (err) {
      setError("Failed to fetch specific book recommendation.");
      setClickedSuggestionBook(null);
      console.error("Fetch error on suggestion click:", err);
    } finally {
      setIsLoading(false);
    }
  }, []); // Dependensi kosong, karena logikanya hanya bergantung pada suggestionTitle dari argumen

  // --- Fungsi untuk Toggle Genre ---
  const toggleGenre = useCallback((genre) => {
    // Gunakan useCallback
    setActiveGenres((prevGenres) => {
      const newGenres = new Set(prevGenres);
      if (newGenres.has(genre)) {
        newGenres.delete(genre);
      } else {
        newGenres.add(genre);
      }
      return newGenres;
    });
  }, []); // Dependensi kosong karena hanya mengubah state internal berdasarkan argumen

  // --- Memoized: Dapatkan Genre Unik ---
  const uniqueGenres = useMemo(() => {
    let sourceBooks = [];
    if (isSuggestionResult && clickedSuggestionBook) {
      // Jika hasil dari klik saran, genre hanya dari buku itu
      sourceBooks = [clickedSuggestionBook];
    } else if (books.length > 0) {
      // Jika ada hasil pencarian utama
      sourceBooks = books;
    } else if (fallbackBooks.length > 0) {
      // Jika ada hasil fallback (no match)
      sourceBooks = fallbackBooks;
    } else {
      // Jika belum ada pencarian, gunakan defaultBooks
      sourceBooks = defaultBooks;
    }

    const genres = new Set();
    sourceBooks.forEach((book) => {
      if (Array.isArray(book.categories)) {
        book.categories.forEach((cat) => genres.add(cat));
      } else if (typeof book.categories === "string" && book.categories) {
        // Jika category adalah string, split berdasarkan koma atau lainnya jika perlu
        // Contoh: "Fiction, Thriller" -> ["Fiction", "Thriller"]
        book.categories
          .split(",")
          .map((cat) => cat.trim())
          .forEach((cat) => genres.add(cat));
      }
    });
    return Array.from(genres).sort();
  }, [books, fallbackBooks, defaultBooks, isSuggestionResult, clickedSuggestionBook]); // Dependensi

  // --- Memoized: Filter Buku Berdasarkan Genre ---
  const filteredBooks = useMemo(() => {
    let booksToFilter = [];

    // Prioritas sumber buku untuk filtering
    if (isSuggestionResult && clickedSuggestionBook) {
      // Jika hasil dari klik saran, filter genre tidak berlaku, tampilkan saja buku itu
      return [clickedSuggestionBook];
    } else if (books.length > 0) {
      booksToFilter = books;
    } else if (fallbackBooks.length > 0) {
      booksToFilter = fallbackBooks;
    } else {
      booksToFilter = defaultBooks;
    }

    if (activeGenres.size === 0) {
      return booksToFilter; // Jika tidak ada genre aktif, tampilkan semua buku dari sumber yang relevan
    }

    // Filter buku berdasarkan genre yang aktif
    return booksToFilter.filter((book) => {
      if (!book.categories) return false;

      if (Array.isArray(book.categories)) {
        return book.categories.some((cat) => activeGenres.has(cat));
      }
      // Jika categories adalah string tunggal atau koma-separated string
      return book.categories
        .split(",")
        .map((cat) => cat.trim())
        .some((cat) => activeGenres.has(cat));
    });
  }, [books, fallbackBooks, defaultBooks, activeGenres, isSuggestionResult, clickedSuggestionBook]); // Dependensi

  return (
    // Gunakan React Fragment untuk membungkus multiple root elements
    <>
      <div className="main-wrapper">
        <div className="app-container">
          <h1 className="app-title">AlgoReads</h1>

          <div className="search-container">
            <SearchAutocomplete value={searchQuery} onChange={setSearchQuery} onSubmit={handleSearch} onSuggestionClick={handleSuggestionClick} className="search-input" ariaLabel="Search books" spellCheck={false} />

            <button onClick={handleSearch} className="search-button" disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </button>
            <button onClick={handleGoHome} className="home-button">
              Home
            </button>
          </div>

          {/* Genre filter muncul jika ada buku DAN BUKAN hasil dari klik saran tunggal */}
          {/* Jika isSuggestionResult TRUE, maka clickedSuggestionBook hanya menampilkan 1 buku, filter genre tidak relevan */}
          {filteredBooks.length > 0 && !isSuggestionResult && (
            <div className="genre-container" aria-label="Filter by genres">
              <h2>Genres</h2>
              <div className="genre-grid">
                {uniqueGenres.map(
                  (
                    genre // Gunakan uniqueGenres dari useMemo
                  ) => (
                    <button
                      key={genre}
                      onClick={() => toggleGenre(genre)} // Gunakan toggleGenre dari useCallback
                      className={`genre-button ${activeGenres.has(genre) ? "active" : ""}`}
                      aria-pressed={activeGenres.has(genre)}
                    >
                      {genre}
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* Pesan error */}
          {error && (
            <div className="message-container" role="alert" aria-live="polite">
              <p className="error-text">{error}</p>
            </div>
          )}

          {/* Pesan fallback jika no match (showSuggestions adalah true) */}
          {showSuggestions && fallbackBooks.length > 0 && (
            <>
              <div className="message-container suggestion-text">
                <p>Instead, you may be interested in:</p>
              </div>
              <div className="results-grid">
                {filteredBooks // filteredBooks sudah mencakup fallbackBooks
                  .filter((book) => book.score > 0.15)
                  .sort((a, b) => b.score - a.score)
                  .map((book, idx) => (
                    <BookCard key={`fallback-${idx}`} book={book} onSelect={setSelectedBook} />
                  ))}
              </div>
            </>
          )}

          {/* Jika tidak no match dan ada hasil pencarian utama (books.length > 0), TAPI BUKAN hasil dari klik saran */}
          {!showSuggestions && books.length > 0 && searchQuery.trim() !== "" && !isSuggestionResult && (
            <>
              <div className="message-container">
                <p>Top results for '{searchQuery}'</p>
              </div>
              <div className="results-grid">
                {filteredBooks // filteredBooks sudah mencakup books
                  .filter((book) => book.score > 0.15)
                  .map((book, idx) => (
                    <BookCard key={`search-${idx}`} book={book} onSelect={setSelectedBook} />
                  ))}
              </div>
            </>
          )}

          {/* --- Bagian untuk Menampilkan Hasil dari Klik Saran --- */}
          {isSuggestionResult && clickedSuggestionBook && (
            <>
              <div className="message-container">
                <p>Result for '{clickedSuggestionBook.title}'</p>
              </div>
              <div className="results-grid">
                {/* Hanya tampilkan satu BookCard untuk buku yang diklik */}
                <BookCard key={`suggestion-clicked-${clickedSuggestionBook.title}`} book={clickedSuggestionBook} onSelect={setSelectedBook} />
              </div>
            </>
          )}
          {/* --- Akhir Bagian Hasil Saran --- */}

          {/* Jika belum ada pencarian (searchQuery kosong) dan ada defaultBooks */}
          {searchQuery.trim() === "" &&
            defaultBooks.length > 0 &&
            !isSuggestionResult && ( // Pastikan juga bukan hasil saran
              <>
                <div className="message-container">
                  <p>Recommended books for you:</p>
                </div>
                <div className="results-grid">
                  {filteredBooks // filteredBooks sudah mencakup defaultBooks
                    .filter((book) => book.score > 0.15)
                    .map((book, idx) => (
                      <BookCard key={`default-${idx}`} book={book} onSelect={setSelectedBook} />
                    ))}
                </div>
              </>
            )}

          {/* Modal untuk detail buku */}
          {selectedBook && <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} isOpen={!!selectedBook} />}
        </div>{" "}
        {/* Penutup app-container */}
      </div>{" "}
      {/* Penutup main-wrapper */}
    </>
  );
}
