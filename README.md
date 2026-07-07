# WatchWizards

AI-powered movie and TV show recommendation engine. Pick your languages, genres, plot keywords, and preferred cast — the AI curates 5 titles, then each is verified and enriched against TMDB with posters, ratings, cast, director, and direct IMDb/TMDB links.

## Features

- **Solo Mode** — personalised recommendations based on content type (movies or shows), language, genre, plot elements, similar titles, preferred year/cast, and maturity filters
- **Popular Right Now** — the 5 most popular movies and 5 most popular shows released in the past 3 months, pulled live from TMDB
- **Multi-provider AI** — structured-output recommendations via Claude, Gemini, OpenAI, or DeepSeek (OpenRouter). Only providers with a configured key are tried; they fall through best-first
- **TMDB enrichment** — every AI suggestion is matched against TMDB by title + year + language (Levenshtein similarity), then enriched with poster, genres, rating, cast, director, and external links
- **Similar / Different** — after receiving results, request more titles that are similar to or different from the current set
- **Group Mode** — coming soon

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Custom CSS with Framer Motion animations
- **AI Providers**: Anthropic Claude, Google Gemini, OpenAI, DeepSeek via OpenRouter
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
# Tried best-first: Claude -> Gemini -> OpenAI -> DeepSeek
# Only providers with a key set will be used.

# ANTHROPIC_API_KEY=sk-ant-...        # https://console.anthropic.com/settings/keys
GEMINI_API_KEY=your_gemini_key         # https://aistudio.google.com/app/apikey
# OPENAI_API_KEY=sk-proj-...           # https://platform.openai.com/api-keys
# OPENROUTER_API_KEY=sk-or-...         # https://openrouter.ai/keys (uses DeepSeek)

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

## Deploying to Vercel

### One-click

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yaseenscodemuseum/Watchwizards)

### Manual

1. Push your repo to GitHub
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in the Vercel dashboard (Settings > Environment Variables)
4. Deploy — Vercel auto-detects Next.js, no extra config needed

### Environment Variables on Vercel

Add these in **Settings > Environment Variables**. All are read at runtime (`process.env`) — none are embedded at build time, so you can change them without redeploying.

| Variable | Required | Description |
|---|---|---|
| `TMDB_API_KEY` | Yes | TMDB API key for movie/show data |
| `GEMINI_API_KEY` | At least one AI key | Google Gemini API key |
| `ANTHROPIC_API_KEY` | At least one AI key | Anthropic Claude API key |
| `OPENAI_API_KEY` | At least one AI key | OpenAI API key |
| `OPENROUTER_API_KEY` | At least one AI key | OpenRouter API key (uses DeepSeek) |
| `OMDB_API_KEY` | No | OMDB API key (supplementary data) |

**At least one AI provider key is required.** The app tries them in order (Claude > Gemini > OpenAI > DeepSeek) and uses the first one that succeeds. If you only want one, Gemini is the cheapest option.

## Project Structure

```
src/
  app/
    page.tsx                           # Landing page
    selection/page.tsx                 # Mode selection (Solo / Group)
    solo/page.tsx                      # Solo recommendation form + results
    popular/page.tsx                   # Popular movies & shows (TMDB)
    group/page.tsx                     # Group mode (coming soon)
    api/
      recommendations/
        route.ts                       # POST — main recommendation endpoint
        similar/route.ts               # POST — similar recommendations
        different/route.ts             # POST — different recommendations
        service.ts                     # AI providers, TMDB enrichment, prompts
      popular/route.ts                 # GET — trending movies & shows
    globals.css                        # All styles
    layout.tsx                         # Root layout, fonts, analytics
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
- [Anthropic](https://www.anthropic.com/), [Google AI](https://ai.google.dev/), [OpenAI](https://openai.com/), and [DeepSeek](https://deepseek.com/) for AI capabilities
- [Vercel](https://vercel.com/) for hosting

---

Made with a lot of sweat, broken furniture, and effort by Yaseen
