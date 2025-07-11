# EHCO - Public Figure Chronicle 📰

> A sophisticated web application that curates and presents comprehensive stories of public figures by intelligently processing and organizing news articles from multiple sources.

## 🎯 What is EHCO?

EHCO is a Next.js application that automatically gathers news articles about public figures, processes them using AI, and presents them as organized timelines and stories. Think of it as an automated biography generator that stays current with the latest news.

**Live Demo:** [Your production URL here]

---

## 🏗️ Project Architecture

### High-Level Overview
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   News Sources  │    │   AWS EC2 Server │    │   EHCO Web App  │
│   (RSS Feeds)   │ ── │   (Crawler)      │ ── │   (Next.js)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │   AI Processing  │
                       │ (Claude/Deepseek)│
                       └──────────────────┘
                                │
                       ┌──────────────────┐
                       │    Firebase      │
                       │   (Database)     │
                       └──────────────────┘
```

### Tech Stack
- **Frontend:** Next.js 15 with App Router, TypeScript, Tailwind CSS
- **Backend:** Firebase (Database), AWS EC2 (News Crawler)
- **AI Processing:** Claude API, Deepseek API
- **Search:** Algolia
- **Deployment:** Vercel
- **Additional Tools:** React Query, Swiper, Lucide React

---

## 🚀 Getting Started

### Prerequisites
Before you begin, make sure you have:
- **Node.js** (version 18.x or later)
- **npm, yarn, or pnpm** package manager
- **Firebase project** set up
- **API keys** for Claude and/or Deepseek
- **Algolia account** (for search functionality)

### Step 1: Clone and Install
```bash
# Clone the repository
git clone [your-repository-url]
cd ehco-dev

# Install dependencies
npm install
```

### Step 2: Environment Setup
Create your environment file by copying the example:
```bash
cp .env.example .env.local
```

Fill in your `.env.local` file with the required credentials:
```bash
# Firebase Configuration
FIREBASE_CONFIG_PATH="path/to/your/firebase-config.json"
FIREBASE_DEFAULT_DATABASE_URL="https://your-project.firebaseio.com"
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"

# AI API Keys
DEEPSEEK_API_KEY="your-deepseek-api-key"
ANTHROPIC_API_KEY="your-claude-api-key"
```

### Step 3: Firebase Setup
1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Firestore Database
3. Create a service account and download the JSON key file
4. Set up Firestore security rules (see `firestore.rules` file)

### Step 4: Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your application running!

---

## 📁 Project Structure

```
ehco-dev/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── [publicFigure]/     # Dynamic routes for public figures
│   │   ├── api/                # API routes
│   │   ├── search/             # Search functionality
│   │   ├── all-figures/        # Browse all figures
│   │   └── ...                 # Other static pages
│   ├── components/             # Reusable React components
│   ├── context/                # React context providers
│   ├── lib/                    # Utility functions and configurations
│   └── types/                  # TypeScript type definitions
├── public/                     # Static assets
├── functions/                  # Firebase Cloud Functions
├── python/                     # Python scripts (likely for data processing)
└── firebase/                   # Firebase configuration files
```

### Key Directories Explained

**`src/app/`** - All your application pages and routes
- `[publicFigure]/` - Dynamic pages that show individual public figure profiles
- `api/` - Backend API endpoints for data fetching and processing
- `search/` - Search interface and functionality

**`src/components/`** - Shared UI components like:
- Timeline components for displaying chronological events
- Article cards for news article display
- Navigation and layout components

**`src/lib/`** - Core business logic including:
- Firebase database interactions
- AI API integrations
- News article processing utilities
- Data formatting and validation

---

## 🔄 How EHCO Works

### Data Flow Process

1. **News Collection**
   - AWS EC2 server crawls RSS feeds from news sources (primarily Yonhap News)
   - Static IP ensures reliable access to whitelisted news sources

2. **AI Processing**
   - Raw articles are sent to AI models (Claude/Deepseek)
   - AI extracts key information, generates summaries, and identifies public figures
   - Articles are categorized and tagged with relevant metadata

3. **Data Storage**
   - Processed data is stored in Firebase Firestore
   - Images and media assets are optimized and cached

4. **Web Application**
   - Next.js app fetches data using Incremental Static Regeneration (ISR)
   - Pages are rebuilt every hour to include latest articles
   - Search functionality powered by Algolia

### Key Features

**Dynamic Public Figure Pages**
- Automatically generated pages for each public figure
- Timeline view of major events and news
- Article grouping and story formation

**Smart Search**
- Algolia-powered search across all figures and articles
- Real-time suggestions and filtering

**Performance Optimized**
- ISR ensures fast loading while keeping content fresh
- Image optimization for all external news sources
- Efficient caching strategies

---

## 🛠️ Development Guide

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Sync data with Algolia search
npm run sync-algolia

# Generate sitemap (runs automatically after build)
npm run postbuild
```

### Adding New Public Figures

1. **Data Collection**: The crawler automatically identifies new public figures from news articles
2. **AI Processing**: AI models extract basic information and generate initial summaries
3. **Manual Review**: Review and refine the generated content if needed
4. **Publication**: New figures appear automatically once sufficient data is collected

### Customizing the UI

The application uses Tailwind CSS for styling. Key design principles:
- Mobile-first responsive design
- Clean, news-focused interface
- Accessibility considerations throughout

### API Integration

The app integrates with several external services:
- **Firebase**: Primary database and authentication
- **Claude API**: Advanced text processing and summarization
- **Deepseek API**: Alternative AI processing
- **Algolia**: Search functionality

---

## 🚀 Deployment

### Deploying to Vercel

1. **Connect Repository**
   ```bash
   # Push your code to GitHub
   git push origin main
   ```

2. **Vercel Setup**
   - Import project from GitHub in Vercel dashboard
   - Configure environment variables in Vercel project settings
   - Deploy automatically on push to main branch

3. **Environment Variables**
   Add all variables from your `.env.local` file to Vercel:
   - Firebase configuration
   - API keys for Claude and Deepseek
   - Any other required credentials

4. **Custom Domain** (Optional)
   - Configure custom domain in Vercel dashboard
   - Update DNS settings with your domain provider

### Production Considerations

- **Database Scaling**: Monitor Firebase usage and upgrade plan if needed
- **API Rate Limits**: Implement proper rate limiting for AI API calls
- **Image Optimization**: Ensure all external image sources are properly configured
- **Monitoring**: Set up error tracking and performance monitoring

---

## 🔧 Configuration Files

### Key Configuration Files

**`next.config.ts`** - Next.js configuration
- Image optimization settings for external news sources
- Build and runtime configurations

**`firebase.json`** - Firebase project configuration
- Firestore rules and indexes
- Cloud Functions deployment settings

**`tailwind.config.ts`** - Tailwind CSS customization
- Custom colors, fonts, and design tokens

**`tsconfig.json`** - TypeScript configuration
- Path aliases and compilation settings

---

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow existing code patterns
   - Add proper TypeScript types
   - Include tests for new functionality

3. **Test Locally**
   ```bash
   npm run dev
   npm run lint
   ```

4. **Submit Pull Request**
   - Provide clear description of changes
   - Include screenshots for UI changes

### Code Style Guidelines

- Use TypeScript for all new code
- Follow existing naming conventions
- Comment complex business logic
- Keep components focused and reusable

---

## 📚 Additional Resources

### Documentation Links
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Anthropic Claude API](https://docs.anthropic.com)

### Support and Contact
- Create issues in the GitHub repository for bugs
- Contact the development team for questions
- Check existing documentation before asking questions

---

## 📝 License

[Include your license information here]

---

## 🔌 API Documentation

### Base URL
```
Production: https://ehco.ai/api
Development: http://localhost:3000/api
```

### Authentication
All public endpoints require no authentication. Internal endpoints use Firebase Authentication.

### Core Endpoints

#### 1. Get All Public Figures
```http
GET /api/public-figures
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 18)
- `sort` (optional): Sort order (`az`, `za`, `recent`, `popular`)
- `gender[]` (optional): Filter by gender (`Male`, `Female`, `Group`)
- `occupation[]` (optional): Filter by occupation (`Singer`, `Actor`, etc.)
- `nationality[]` (optional): Filter by nationality (`South Korean`, etc.)

**Response:**
```json
{
  "publicFigures": [
    {
      "id": "iu",
      "name": "IU",
      "name_kr": "아이유",
      "nationality": "South Korean",
      "occupation": ["Singer", "Actor"],
      "profilePic": "https://example.com/iu.jpg",
      "gender": "Female",
      "is_group": false,
      "birthDate": "1993-05-16",
      "company": "EDAM Entertainment",
      "debutDate": "2008-09-18"
    }
  ],
  "totalCount": 150,
  "totalPages": 9,
  "currentPage": 1,
  "pageSize": 18,
  "appliedFilters": {
    "gender": ["Female"],
    "occupation": ["Singer"]
  }
}
```

#### 2. Get Public Figure Content
```http
GET /api/public-figure-content/[publicFigure]
```

**Parameters:**
- `publicFigure`: The public figure's ID (e.g., "iu", "kim-soo-hyun")

**Response:**
```json
{
  "main_overview": {
    "id": "main-overview",
    "content": "IU is a South Korean singer-songwriter and actress...",
    "articleIds": ["article1", "article2"]
  },
  "timeline_content": {
    "schema_version": "v2_curated",
    "data": {
      "Creative Works": {
        "description": "Musical releases and acting projects",
        "subCategories": {
          "Albums": [
            {
              "event_title": "Love Poem Album Release",
              "event_summary": "IU's fifth studio album",
              "event_years": [2019],
              "primary_date": "2019-11-01",
              "timeline_points": [
                {
                  "date": "2019-11-01",
                  "description": "Released Love Poem album"
                }
              ],
              "status": "completed",
              "sources": ["article123"]
            }
          ]
        }
      }
    }
  }
}
```

#### 3. Get Articles by IDs
```http
GET /api/articles?ids=article1,article2,article3
```

**Query Parameters:**
- `ids`: Comma-separated list of article IDs

**Response:**
```json
[
  {
    "id": "article1",
    "subTitle": "IU Announces New Album",
    "body": "South Korean singer IU has announced...",
    "source": "Yonhap News",
    "link": "https://en.yna.co.kr/view/...",
    "imageUrls": ["https://example.com/image1.jpg"],
    "imageCaptions": ["IU at press conference"],
    "sendDate": "20241201"
  }
]
```

#### 4. Get Article Summaries
```http
GET /api/article-summaries?ids=summary1,summary2
```

**Response:**
```json
[
  {
    "id": "summary1",
    "event_contents": {
      "2024-12-01": "IU released her new single",
      "2024-12-05": "Music video premiered on YouTube"
    },
    "category": "Creative Works",
    "subCategory": "Singles",
    "title": "New Single Release"
  }
]
```

#### 5. Newsletter Subscription
```http
POST /api/newsletter/subscribe
```

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully subscribed to newsletter"
}
```

---

## 📊 Data Architecture Deep Dive

### Database Schema (Firebase Firestore)

#### Collections Structure
```
firestore/
├── selected-figures/                 # Main public figures collection
│   ├── {figureId}/                  # Document per public figure
│   │   ├── curated-timeline/        # Subcollection for v2 timeline data
│   │   │   ├── {mainCategory}/      # Creative Works, Personal Milestones, etc.
│   │   │   └── ...
│   │   └── wiki-content/            # Subcollection for v1 legacy data
│   │       ├── main-overview        # Overview content
│   │       ├── {category}           # Category documents
│   │       └── ...
├── newsArticles/                    # Raw news articles
│   ├── {articleId}/                 # Individual article documents
│   └── ...
└── articleSummaries/               # AI-processed article summaries
    ├── {summaryId}/                # Summary documents
    └── ...
```

#### Document Structure Examples

**Public Figure Document (`selected-figures/{figureId}`):**
```json
{
  "name": "IU",
  "name_kr": "아이유",
  "nationality": "South Korean",
  "occupation": ["Singer", "Actor"],
  "gender": "Female",
  "is_group": false,
  "birthDate": "1993-05-16",
  "company": "EDAM Entertainment",
  "debutDate": "2008-09-18",
  "profilePic": "https://example.com/iu.jpg",
  "instagramUrl": "https://instagram.com/dlwlrma",
  "youtubeUrl": "https://youtube.com/c/1theK",
  "spotifyUrl": "https://open.spotify.com/artist/...",
  "lastUpdated": "2024-12-20T10:30:00Z"
}
```

**News Article Document (`newsArticles/{articleId}`):**
```json
{
  "title": "IU Announces Concert Tour",
  "subTitle": "Singer to perform in 10 cities",
  "body": "South Korean singer IU has announced...",
  "source": "Yonhap News Agency",
  "link": "https://en.yna.co.kr/view/...",
  "imageUrls": ["https://example.com/image1.jpg"],
  "imageCaptions": ["IU at press conference"],
  "sendDate": "20241201",
  "publicFigure": "iu",
  "tags": ["concert", "tour", "music"]
}
```

**Article Summary Document (`articleSummaries/{summaryId}`):**
```json
{
  "id": "summary123",
  "category": "Creative Works",
  "subCategory": "Concerts",
  "title": "2024 Concert Tour Announcement",
  "event_contents": {
    "2024-12-01": "Announced 2024 world tour",
    "2024-12-15": "Ticket sales begin"
  },
  "content": "IU announced her 2024 world tour...",
  "articleIds": ["article1", "article2"],
  "processedAt": "2024-12-01T15:30:00Z"
}
```

### Data Processing Pipeline

#### 1. News Collection (AWS EC2 Server)
```python
# Example Python crawler structure
class NewsArticleCrawler:
    def __init__(self):
        self.rss_feeds = [
            "https://en.yna.co.kr/RSS/entertainment.xml",
            # Additional RSS feeds
        ]
    
    def crawl_articles(self):
        """Crawl RSS feeds and extract articles"""
        for feed_url in self.rss_feeds:
            articles = self.parse_rss_feed(feed_url)
            for article in articles:
                self.process_article(article)
    
    def process_article(self, article):
        """Process individual article"""
        # Extract text, images, metadata
        # Store in Firebase
        pass
```

#### 2. AI Processing (Claude/Deepseek Integration)
```typescript
// Example AI processing service
class AIProcessor {
  async processArticle(article: Article): Promise<ArticleSummary> {
    const prompt = `
      Analyze this news article about ${article.publicFigure}:
      Title: ${article.title}
      Content: ${article.body}
      
      Extract:
      1. Key events with dates
      2. Category classification
      3. Event significance
    `;
    
    const response = await this.claudeAPI.complete({
      model: "claude-3-sonnet-20240229",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1000
    });
    
    return this.parseAIResponse(response.content);
  }
}
```

#### 3. Data Transformation Pipeline
```typescript
// Transform raw data into frontend-ready format
class DataTransformer {
  transformTimelineData(events: CuratedEvent[]): TimelineData {
    // Group events by category and subcategory
    // Sort chronologically
    // Add source references
    return transformedData;
  }
}
```

---

## 🧩 Component Architecture

### Component Hierarchy
```
App/
├── Layout                           # Main app layout
│   ├── Header                      # Navigation and search
│   └── Footer                      # Links and copyright
├── [publicFigure]/                 # Dynamic public figure pages
│   ├── ProfileInfo                 # Profile details and links
│   ├── MainOverview               # AI-generated summary
│   ├── CuratedTimelineView        # v2 timeline display
│   │   ├── Timeline               # Timeline component
│   │   └── TimelineSourceSwiper   # Article sources
│   └── LegacyWikiView            # v1 fallback display
├── search/                        # Search functionality
│   └── SearchSlider               # Search interface
├── all-figures/                   # Browse all figures
└── about-ehco/                    # About page
```

### Key Component Details

#### Timeline Component
**Purpose:** Displays chronological events with filtering and source integration

**Key Features:**
- Year-based filtering with sticky sidebar
- Hierarchical date display (Year > Month > Day)
- Collapsible source articles with Swiper integration
- Responsive design with mobile optimization

**Usage:**
```tsx
<Timeline
  articleSummaries={summaries}
  categoryContent={wikiContent}
  selectedCategory="Creative Works"
  selectedSubcategories={["Albums", "Singles"]}
  articles={articles}
/>
```

#### ProfileInfo Component
**Purpose:** Displays public figure basic information and social links

**Props Interface:**
```typescript
interface ProfileInfoProps {
  publicFigureData: PublicFigure;
}

type PublicFigure = IndividualPerson | GroupProfile;
```

**Features:**
- Responsive image display with fallback
- Social media link integration
- Group vs individual figure handling
- Dynamic information fields

#### CuratedTimelineView Component
**Purpose:** Main container for v2 timeline schema display

**Key Responsibilities:**
- Data fetching and state management
- Category filtering and selection
- Integration with Timeline and ProfileInfo components
- Loading states and error handling

---

## 🔧 Development Workflow

### Local Development Setup

#### 1. Environment Configuration
Create and configure your environment files:

```bash
# .env.local
FIREBASE_CONFIG_PATH="/path/to/firebase-config.json"
FIREBASE_PROJECT_ID="ehco-85586"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xyz@ehco-85586.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

DEEPSEEK_API_KEY="sk-abcdef123456789"
ANTHROPIC_API_KEY="sk-ant-api03-abcdef123456789"

# Optional: Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS="G-XXXXXXXXXX"
```

#### 2. Firebase Setup
Initialize Firebase in your project:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init

# Select:
# - Firestore
# - Functions
# - Hosting (if deploying to Firebase)
```

#### 3. Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run production build locally
npm run start

# Lint code
npm run lint

# Sync search index
npm run sync-algolia

# Generate sitemap
npm run postbuild
```

### Code Organization Best Practices

#### File Naming Conventions
- **Components:** PascalCase (`ProfileInfo.tsx`)
- **Pages:** lowercase with hyphens (`public-figure-content/`)
- **Utilities:** camelCase (`articleService.ts`)
- **Types:** PascalCase (`definitions.ts`)

#### TypeScript Usage
Always use TypeScript interfaces for:
- API responses
- Component props
- Database documents
- Configuration objects

Example:
```typescript
// Good: Well-defined interfaces
interface PublicFigureAPIResponse {
  publicFigures: PublicFigure[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

// Avoid: Generic any types
const data: any = await fetchData(); // ❌
const data: PublicFigureAPIResponse = await fetchData(); // ✅
```

#### Error Handling Pattern
```typescript
// API routes error handling
export async function GET(request: Request) {
  try {
    // Main logic here
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}

// Component error handling
const [data, setData] = useState<DataType | null>(null);
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetchData()
    .then(setData)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
}, []);
```

---

## 🚨 Troubleshooting Guide

### Common Issues and Solutions

#### 1. Firebase Connection Issues
**Problem:** `Firebase not initialized` or connection timeouts

**Solutions:**
- Verify environment variables are properly set
- Check Firebase service account permissions
- Ensure project ID matches exactly
- Validate private key format (include `\n` line breaks)

```bash
# Test Firebase connection
node -e "
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
console.log('Firebase connected successfully');
"
```

#### 2. API Rate Limiting
**Problem:** `429 Too Many Requests` from AI APIs

**Solutions:**
- Implement exponential backoff
- Add request queuing
- Monitor usage quotas
- Cache AI responses when possible

```typescript
// Exponential backoff example
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}
```

#### 3. Image Loading Issues
**Problem:** Images not displaying or CORS errors

**Solutions:**
- Verify image URLs in `next.config.ts`
- Check image source permissions
- Add fallback image handling
- Use `unoptimized` prop for external images

```typescript
// Image component with error handling
const ProfileImage = ({ src, alt, ...props }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return <div className="fallback-image">Image not available</div>;
  }
  
  return (
    <Image
      src={src}
      alt={alt}
      onError={() => setError(true)}
      unoptimized // For external images
      {...props}
    />
  );
};
```

#### 4. Build/Deployment Issues
**Problem:** Build failures or deployment errors

**Solutions:**
- Check TypeScript errors: `npx tsc --noEmit`
- Verify environment variables in deployment platform
- Clear `.next` cache: `rm -rf .next`
- Check Node.js version compatibility

```bash
# Debug build process
npm run build -- --debug
# or
NEXT_DEBUG=1 npm run build
```

#### 5. Performance Issues
**Problem:** Slow page loads or high memory usage

**Solutions:**
- Implement proper data pagination
- Use React.memo for expensive components
- Optimize bundle size with `npm run analyze`
- Add loading states and skeleton screens

```typescript
// Component optimization
const Timeline = React.memo(({ events, loading }) => {
  if (loading) return <TimelineSkeleton />;
  return <TimelineContent events={events} />;
});

// Pagination hook
const usePagination = (data: any[], pageSize: number = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(data.length / pageSize);
  const currentData = data.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  
  return { currentData, currentPage, totalPages, setCurrentPage };
};
```

### Performance Monitoring

#### Key Metrics to Track
- **Page Load Time:** Target < 3 seconds
- **Core Web Vitals:** LCP, FID, CLS
- **API Response Time:** Target < 500ms
- **Database Query Performance:** Monitor Firestore usage
- **AI API Usage:** Track token consumption

#### Monitoring Tools Setup
```typescript
// Add to layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

---

## 🔒 Security Best Practices

### Environment Variables Security
- Never commit `.env` files to version control
- Use different API keys for development and production
- Rotate API keys regularly
- Implement proper CORS policies

### Firebase Security Rules
```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access for selected-figures
    match /selected-figures/{document} {
      allow read: if true;
      allow write: if false; // Only server-side writes
    }
    
    // Protected collections
    match /newsArticles/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### API Security
```typescript
// Rate limiting middleware
export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const identifier = `${ip}:${request.nextUrl.pathname}`;
  
  const { success } = await rateLimit.limit(identifier);
  
  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }
  
  return NextResponse.next();
}
```

---

*Last updated: December 30, 2024*
*Documentation version: 2.0*