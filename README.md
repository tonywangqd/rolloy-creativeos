# Rolloy Creative OS

AI-powered creative asset generation and analytics platform built with Next.js, Tailwind CSS, and Shadcn UI.

## Features

### Creative Workbench
- **ABCD Framework Configuration**
  - A (Scene): Two-level cascading dropdown
  - B (Action): Action selection
  - C (Driver): Emotional driver selection
  - D (Format): Image/Video format selection
- **Intelligent Naming**: Auto-generates standardized filenames
- **Batch Generation**: Generate 20 creative variants at once
- **Gallery Management**: Select and save your best creatives

### Performance Analytics
- **CSV Data Import**: Upload or paste campaign performance data
- **Smart Insights**:
  - CPA analysis by scene
  - ROAS analysis by emotional driver
  - Format performance comparison (Image vs Video)
- **Interactive Charts**: Built with Recharts

### Settings
- API key management (Gemini, Flux)
- Reference image configuration
- Default parameter customization

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **Components**: Shadcn UI
- **Charts**: Recharts
- **Data Parsing**: PapaParse
- **Icons**: Lucide React

## Getting Started

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Configuration

1. Navigate to **Settings** page
2. Add your API keys:
   - Gemini API Key
   - Flux API Key
3. (Optional) Add reference image URLs
4. (Optional) Customize default prompt template

## Project Structure

```
rolloy-creativeos/
├── app/
│   ├── page.tsx              # Creative Workbench (Home)
│   ├── analytics/
│   │   └── page.tsx          # Analytics Dashboard
│   ├── settings/
│   │   └── page.tsx          # Settings Page
│   ├── layout.tsx            # Root Layout
│   └── globals.css           # Global Styles
├── components/
│   ├── creative/
│   │   ├── abcd-selector.tsx # ABCD Framework Selector
│   │   ├── naming-card.tsx   # Naming Preview Card
│   │   └── gallery.tsx       # Image Gallery
│   ├── analytics/
│   │   ├── csv-uploader.tsx  # CSV Upload Component
│   │   └── insight-dashboard.tsx # Analytics Dashboard
│   ├── layout/
│   │   ├── sidebar.tsx       # Sidebar Navigation
│   │   └── header.tsx        # Top Navigation
│   └── ui/                   # Shadcn UI Components
├── lib/
│   ├── constants/
│   │   └── abcd.ts           # ABCD Framework Data
│   └── utils.ts              # Utility Functions
└── public/                   # Static Assets
```

## Usage Guide

### 1. Creating Creative Assets

1. Select ABCD parameters:
   - Choose Scene Category (e.g., Home)
   - Choose Scene Detail (e.g., Living Room)
   - Select Action (e.g., Using)
   - Select Emotional Driver (e.g., Joy)
   - Select Format (e.g., Image 1:1)

2. Review the auto-generated filename

3. Click **Generate 20 Images**

4. Select your favorite variants from the gallery

5. Click **Save Selected** to download

### 2. Analyzing Performance

1. Prepare your CSV with these columns:
   ```
   Scene, Action, Driver, Format, Impressions, Clicks, Conversions, Cost, Revenue
   ```

2. Upload CSV file or paste data directly

3. View automatic insights:
   - Which scene has the lowest CPA?
   - Which emotional driver has the highest ROAS?
   - Image vs Video performance comparison

## Naming Convention

Generated filenames follow this format:

```
YYYYMMDD_[SceneCategory]_[SceneDetail]_[Action]_[Driver]_[FormatCode]
```

Example:
```
20250105_[Home]_[Living Room]_[Using]_[Joy]_[IMG_1_1]
```

## Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key
NEXT_PUBLIC_FLUX_API_KEY=your_flux_key
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deployment

Deploy easily with Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
