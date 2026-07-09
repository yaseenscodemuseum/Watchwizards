# WatchWizards

AI-powered movie and TV show recommendation engine. Pick your languages, genres, plot keywords, and preferred cast — the AI curates 5 titles, then each is verified and enriched against TMDB with posters, ratings, cast, director, and direct IMDb/TMDB links.

## Features

- **Solo Mode** — personalised recommendations based on content type (movies or shows), language, genre, plot elements, similar titles, preferred year/cast, and maturity filters
- **Popular Right Now** — the 5 most popular movies and 5 most popular shows released in the past 3 months, pulled live from TMDB
- **Multi-provider AI** — structured-output recommendations via Claude, Gemini (2.5 Flash / 2.0 Flash), OpenAI, Tencent Hy3, or GPT-OSS-120B (the latter two via OpenRouter). Only providers with a configured key are tried; they fall through best-first, and any single key is enough for the app to work
- **TMDB enrichment** — every AI suggestion is matched against TMDB by title + year + language (Levenshtein similarity), then enriched with poster, genres, rating, cast, director, and external links
- **Similar / Different** — after receiving results, request more titles that are similar to or different from the current set
- **Group Mode** — coming soon

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Custom CSS with Framer Motion animations
- **AI Providers**: Anthropic Claude, Google Gemini, OpenAI, Tencent Hy3 & GPT-OSS-120B via OpenRouter
- **Data**: TMDB API, OMDB API
- **Deployment**: Vercel

## Getting Started (Local)

### Prerequisites

- Node.js 18+ and npm
- At least one AI provider API key (Gemini is the cheapest to start with)
- A TMDB API key (free at https://www.themoviedb.org/settings/api)

### 1. Clone and install

```bash
git clone https://github.com/yaseenscodemuseum/Watchwizards.git
cd Watchwizards
npm install
```

### 2. Create `.env.local`

```env
# --- AI providers (at least one required) ---
# Tried best-first: Claude -> Gemini 2.5 Flash -> Gemini 2.0 Flash -> OpenAI -> Tencent Hy3 -> GPT-OSS-120B
# Only providers with a key set will be used.

# ANTHROPIC_API_KEY=sk-ant-...        # https://console.anthropic.com/settings/keys
GEMINI_API_KEY=your_gemini_key         # https://aistudio.google.com/app/apikey (powers both Gemini models)
# OPENAI_API_KEY=sk-proj-...           # https://platform.openai.com/api-keys
# OPENROUTER_API_KEY=sk-or-...         # https://openrouter.ai/keys (powers Hy3 and GPT-OSS, both free)

# --- Data providers (required) ---
TMDB_API_KEY=your_tmdb_key             # https://www.themoviedb.org/settings/api
OMDB_API_KEY=your_omdb_key             # https://www.omdbapi.com/apikey.aspx (optional)
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build for production

```bash
npm run build
npm start
```

## Credits

If you use this repo, please credit me or send me a photo of you using it on one of my socials — it'd make me really happy to see people appreciating my work.

- **Website**: [yaseensportfolio.vercel.app](https://yaseensportfolio.vercel.app)
- **Instagram**: [@yaleftonseen](https://www.instagram.com/yaleftonseen/)
- **Email**: yaseenabdulaziz18@gmail.com
- **LinkedIn**: [Mohammad Yaseen Abdul Aziz](https://www.linkedin.com/in/mohammad-yaseen-abdul-aziz/)
- **GitHub**: [yaseenscodemuseum](https://github.com/yaseenscodemuseum)

## Acknowledgments

- [TMDB](https://www.themoviedb.org/) for the movie and TV database API
- [Anthropic](https://www.anthropic.com/), [Google AI](https://ai.google.dev/), [OpenAI](https://openai.com/), and [Tencent Hunyuan](https://hunyuan.tencent.com/) for AI capabilities
- [Vercel](https://vercel.com/) for hosting

---

Made with a lot of sweat, broken furniture, and effort by Yaseen
