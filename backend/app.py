from flask import Flask, request, jsonify
import joblib
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import linear_kernel
from flask_cors import CORS
import os
from datetime import datetime
from deep_translator import GoogleTranslator
import json
import requests
from io import BytesIO

app = Flask(__name__)

# --- Konfigurasi CORS ---
# Di produksi, sebaiknya ganti "*" dengan URL frontend Anda yang spesifik setelah di-deploy.
# Contoh: origins=["https://your-frontend-app.vercel.app", "http://localhost:3000"]
# Anda juga bisa mengambilnya dari Environment Variable (misalnya os.getenv("CORS_ORIGINS").split(","))
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- LOGGING (Modifikasi untuk Produksi) ---
# Di lingkungan produksi (seperti Railways), menulis log ke file lokal (logs/query_log.json)
# TIDAK disarankan karena sistem file ephemeral (log akan hilang saat restart/deploy).
# Sebaiknya gunakan sistem logging berbasis konsol atau layanan logging eksternal.

# Jika Anda tetap ingin mengizinkan logging ke file untuk pengembangan lokal,
# Anda bisa menggunakan variabel lingkungan untuk mengontrolnya.
# Contoh: is_production = os.getenv("FLASK_ENV") == "production"

# Untuk deployment, saya akan mengomentari atau memodifikasi bagian ini.
# Saya akan menghapus os.makedirs dan save_query_to_json untuk deployment ini.
# Jika Anda tetap ingin menyimpan log, pertimbangkan database atau object storage (S3, GCS).
# Untuk contoh ini, kita fokus pada fungsionalitas inti dan log di konsol (stdout).

# Fungsi simpan log ke JSON - Dinonaktifkan untuk deployment ke ephemeral filesystem
# def save_query_to_json(query, results):
#     log_file = "logs/query_log.json"
#     os.makedirs("logs", exist_ok=True) # Perlu memastikan folder ada, tapi di prod ini ephemeral
#     log_entry = {
#         "timestamp": datetime.now().isoformat(),
#         "query": query,
#         "results": results
#     }
#     with open(log_file, "a", encoding="utf-8") as f:
#         f.write(json.dumps(log_entry) + "\n")

# --- Fungsi untuk load dari Hugging Face (URL Diperbaiki) ---
# Perbaikan: Menggunakan 'resolve/main' bukan 'blob/main' untuk direct download.
def load_from_hf(file_url):
    print(f"DEBUG: Attempting to load from: {file_url}") # Debug print
    response = requests.get(file_url, stream=True) # Use stream=True for potentially large files
    response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
    return BytesIO(response.content)

# --- Load model dan data dari Hugging Face ---
# Pastikan URL adalah 'resolve/main' untuk mendapatkan file mentah.
try:
    cosine_sim = joblib.load(load_from_hf("https://huggingface.co/NalendraMarchelo/Capstone_DBS/resolve/main/cosine_sim.joblib"))
    tfidf = joblib.load(load_from_hf("https://huggingface.co/NalendraMarchelo/Capstone_DBS/resolve/main/tfidf.joblib"))
    tfidf_matrix = joblib.load(load_from_hf("https://huggingface.co/NalendraMarchelo/Capstone_DBS/resolve/main/tfidf_matrix.joblib"))
    books = pd.read_csv(load_from_hf("https://huggingface.co/NalendraMarchelo/Capstone_DBS/resolve/main/processed_books.csv"))
    print("DEBUG: Models and data loaded successfully from Hugging Face.")
except Exception as e:
    print(f"ERROR: Failed to load models/data from Hugging Face: {e}")
    # Jika ini terjadi, aplikasi tidak akan berfungsi. Anda bisa menambahkan
    # penanganan error yang lebih serius atau keluar dari aplikasi.
    exit(1) # Keluar dari aplikasi jika gagal memuat model penting

@app.route("/api/recommend", methods=["POST"])
def recommend():
    data = request.get_json()
    query = data.get("query", "").strip()

    print(f"DEBUG: Received recommendation query: '{query}'") # Log ke konsol

    if not query:
        return jsonify({
            "results": [],
            "message": "Query is empty.",
            "status": "error"
        }), 400

    try:
        # Translate ke Inggris
        try:
            query_en = GoogleTranslator(source='id', target='en').translate(query)
            print(f"DEBUG: Translated query to English: '{query_en}'")
        except Exception as e:
            print(f"Translate error: {e}")
            query_en = query
            print(f"DEBUG: Using original query due to translation error: '{query_en}'")

        query_vec = tfidf.transform([query_en])
        sim_scores = linear_kernel(query_vec, tfidf_matrix).flatten()

        if np.max(sim_scores) == 0:
            fallback = books.sample(5)
            results = []
            for _, row in fallback.iterrows():
                results.append({
                    "title": row.get("title", "Unknown"),
                    "authors": row.get("authors", "-"),
                    "description": row.get("description") if isinstance(row.get("description"), str) else "No description available.",
                    "thumbnail": row.get("thumbnail", "cover-not-found.jpg"),
                    "published_year": row.get("published_year", "N/A"),
                    "average_rating": row.get("average_rating", "N/A"),
                    "score": 0.0
                })

            print(f"DEBUG: No match found for '{query_en}', returning fallback results.")
            # save_query_to_json(query, results) # Logging ke file dinonaktifkan

            return jsonify({
                "results": results,
                "message": f"No match found for '{query_en}', Try another book.",
                "status": "fallback"
            }), 200

        books["sim_score"] = sim_scores
        books_cleaned = books.replace({np.nan: None})

        # Menggunakan .copy() untuk menghindari SettingWithCopyWarning
        # saat memodifikasi DataFrame yang sudah di-slice
        top_books = books_cleaned[books_cleaned["sim_score"] > 0.1].sort_values("sim_score", ascending=False).head(12).copy()

        results = []
        for _, row in top_books.iterrows():
            results.append({
                "title": row.get("title", "Unknown"),
                "authors": row.get("authors", "-"),
                "description": (row.get("description")[:200] + "...") if isinstance(row.get("description"), str) else "No description available.",
                "thumbnail": row.get("thumbnail", "cover-not-found.jpg"),
                "published_year": row.get("published_year", "N/A"),
                "average_rating": row.get("average_rating", "N/A"),
                "score": round(row.get("sim_score", 0), 3),
                "categories": row.get("categories", []),
                "num_pages": row.get("num_pages", "N/A")
            })

        print(f"DEBUG: Returning top results for '{query_en}'. Found {len(results)} books.")
        # save_query_to_json(query, results) # Logging ke file dinonaktifkan

        return jsonify({
            "results": results,
            "message": f"Top results for '{query_en}'",
            "status": "success"
        }), 200

    except Exception as e:
        print(f"ERROR: Server error in /api/recommend: {str(e)}") # Log error ke konsol
        return jsonify({
            "results": [],
            "message": f"Server error: {str(e)}",
            "status": "error"
        }), 500

@app.route("/api/suggestions")
def get_suggestions():
    query = request.args.get("query", "").strip().lower()
    if not query:
        print("DEBUG: Suggestions query is empty, returning empty results.")
        return jsonify({"results": []})

    try:
        print(f"DEBUG: Receiving suggestions query: '{query}'")
        matched = books[books['title'].str.lower().str.contains(query, na=False)].copy() # Gunakan .copy()
        print(f"DEBUG: Number of matched suggestions: {len(matched)}")

        suggestions = matched[['title', 'published_year']].drop_duplicates().head(10).copy() # Gunakan .copy()
        print(f"DEBUG: Number of suggestions after drop_duplicates and head: {len(suggestions)}")

        results = []
        for _, row in suggestions.iterrows():
            results.append({
                "title": row['title'],
                "published_year": row.get('published_year', "N/A")
            })
        print(f"DEBUG: Suggestions results to be sent: {results}")

        return jsonify({"results": results})

    except Exception as e:
        print(f"ERROR: Error in /api/suggestions: {e}") # Log error ke konsol
        return jsonify({
            "results": [],
            "message": f"Server error: {str(e)}",
            "status": "error"
        }), 500

# --- Perbaikan untuk Deployment (Jangan jalankan app.run() di produksi) ---
# Perintah ini hanya akan dieksekusi saat Anda menjalankan file ini langsung
# (misalnya `python app.py`). Di lingkungan produksi, Gunicorn atau WSGI server lain
# akan menjalankan aplikasi Anda.
if __name__ == '__main__':
    print("DEBUG: Running Flask app in debug mode (development only).")
    app.run(debug=True, host='0.0.0.0', port=5000)
    # Tambahkan host='0.0.0.0' agar bisa diakses dari luar localhost saat development