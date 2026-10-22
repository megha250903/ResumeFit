# ResumeFit (Python backend)

FastAPI server that serves the website and runs the analysis through the Groq API.

## Run it
```bash
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
export GROQ_API_KEY=your-key # Windows: set GROQ_API_KEY=your-key
uvicorn app:app --reload
```
Open http://127.0.0.1:8000

Get an API key at https://console.groq.com/keys. Keep it on the server only; never put it in the HTML.

## Files
- `app.py`: API (`POST /api/analyze`), file reading (PDF/DOCX/TXT), prompt, rate limit (10/hour per IP)
- `static/index.html`: the website
- `.env.example`: settings (set them as environment variables)
