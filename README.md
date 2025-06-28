# 🏥 CareLoop

A comprehensive health management application designed specifically for senior citizens, featuring voice-activated medication reminders, AI-powered health assistance, and emergency alert systems.

![Next.js](https://img.shields.io/badge/Next.js-15.3.4-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC)
![Supabase](https://img.shields.io/badge/Supabase-Database-green)

## 🎯 Purpose

CareLoop is designed to empower senior citizens with technology that enhances their health management and safety. The app provides intuitive, voice-controlled interfaces that make medication management and health monitoring accessible for seniors.

## ✨ Key Features

### 🔔 Medication Management
- **Smart Reminders**: Scheduled voice-based medication reminders with visual cues
- **Voice Confirmation**: Speech recognition for medication confirmation ("I took it" or "Yes")
- **AI Visual Verification**: Camera-based pill verification using computer vision technology
- **Hand-to-Mouth Motion Tracking**: AI detection of actual medication-taking movement patterns
- **Persistent Alerts**: Repeated reminders until user responds or confirms
- **Special Instructions**: Support for medication-specific instructions (before/after food, with water, etc.)
- **Family Notifications**: Automatic alerts to family members if medications are missed
- **Positive Reinforcement**: Encouraging feedback after successful medication intake

### 🤖 AI-Powered Voice Assistant
- **Google Gemini Integration**: Advanced AI conversations for health-related queries
- **Bilingual Support**: Full support for English and Malayalam languages
- **Health Monitoring**: Voice queries like "Did I take my diabetes pill today?"
- **Emergency Detection**: Automatic detection of health concerns in speech
- **"Hey Google" Activation**: Voice-triggered assistant activation
- **Natural Conversations**: Context-aware responses and health guidance

### 🆘 Emergency Alert System
- **Quick Alerts**: One-tap emergency buttons for common scenarios
- **Voice Activation**: "I'm not feeling well" triggers immediate alerts
- **Multi-Channel Notifications**: SMS, email, and app notifications to emergency contacts
- **Contact Management**: Manage multiple emergency contacts (family, doctors)
- **Alert History**: Track and review past emergency situations
- **Custom Messages**: Personalized emergency messages

### 🌐 Bilingual Experience
- **Language Auto-Detection**: Automatic detection of Malayalam vs English speech
- **Dual-Language Reminders**: Medication reminders in both languages
- **Cultural Adaptation**: UI and interactions adapted for Indian senior citizens
- **Script Support**: Full Unicode support for Malayalam text

### 🔍 AI Visual Verification
- **Camera Integration**: Real-time video feed for pill verification
- **Pill Detection**: AI-powered identification of pill count, shape, and color
- **Hand-to-Mouth Motion Tracking**: Detection of actual medication-taking movements (🤏→🤚→👄)
- **Motion Pattern Analysis**: Multi-stage tracking from pill pickup to mouth contact
- **Confidence Scoring**: AI confidence levels for verification accuracy
- **Dual Verification Modes**: Switch between pill detection and motion tracking
- **Advanced Confirmation**: Multi-modal verification combining AI, motion tracking, and manual override
- **Progress Tracking**: Real-time analysis progress with visual feedback

### 📱 Senior-Friendly Interface
- **Large Text & Buttons**: Easy-to-read fonts and touch targets
- **High Contrast**: Optimized colors for better visibility
- **Real-Time Clock**: Always-visible current time and date
- **Simple Navigation**: Intuitive layout with minimal complexity
- **Voice Feedback**: Audio confirmations for all interactions

## 🛠️ Tech Stack

### Frontend
- **Next.js 15.3.4** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful, customizable icons

### Backend & Database
- **Supabase** - PostgreSQL database with real-time capabilities
- **Row Level Security** - Secure data access patterns
- **Real-time Subscriptions** - Live data updates

### AI & Voice
- **Google Generative AI (Gemini)** - Advanced language model integration
- **Web Speech API** - Browser-native speech recognition and synthesis
- **Custom Speech Processing** - Language detection and processing

### Computer Vision & Camera
- **MediaDevices API** - Real-time camera access and video streaming
- **Canvas API** - Image processing and frame capture
- **AI Image Analysis** - Simulated computer vision for pill detection
- **Motion Tracking** - Hand-to-mouth movement pattern recognition
- **Multi-Stage Detection** - Sequential tracking of medication-taking motions
- **Real-time Processing** - Live video analysis with progress feedback

### UI & UX
- **react-hot-toast** - Beautiful toast notifications
- **Responsive Design** - Mobile-first, tablet-optimized
- **Progressive Web App** - Installable web application

### Development Tools
- **ESLint** - Code linting and quality
- **PostCSS** - CSS processing
- **Turbopack** - Fast development builds

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google AI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/udhayk7/careloop.git
   cd careloop
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   NEXT_PUBLIC_GOOGLE_AI_API_KEY=your_google_ai_api_key
   ```

4. **Database Setup**
   
   Create these tables in your Supabase database:
   
   ```sql
   -- Senior Profiles Table
   CREATE TABLE senior_profiles (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     family_id TEXT,
     full_name TEXT NOT NULL,
     age INTEGER,
     health_conditions TEXT[],
     other_health_condition TEXT,
     emergency_contact TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
   );

   -- Medications Table
   CREATE TABLE medications (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     senior_id UUID REFERENCES senior_profiles(id),
     name TEXT NOT NULL,
     dosage TEXT,
     frequency TEXT,
     instructions TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
   );
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📊 Database Schema

### Senior Profiles
- **id**: Unique identifier
- **family_id**: Family group identifier
- **full_name**: Senior's full name
- **age**: Age in years
- **health_conditions**: Array of health conditions
- **emergency_contact**: Primary emergency contact

### Medications
- **id**: Unique identifier
- **senior_id**: Reference to senior profile
- **name**: Medication name
- **dosage**: Dosage information
- **frequency**: How often to take
- **instructions**: Special instructions

## 🔧 Configuration

### Supabase Setup
1. Create a new Supabase project
2. Set up Row Level Security (RLS) policies
3. Add the database schema
4. Configure authentication if needed

### Google AI Setup
1. Get an API key from Google AI Studio
2. Add the key to your environment variables
3. Configure rate limits and safety settings

## 🎮 Usage

### For Seniors
1. **Taking Medications**: Respond to voice reminders with "I took it" or "Yes"
2. **Visual Verification**: Use the "📷 AI Verify" button to verify pills with camera
3. **Motion Verification**: Take medication naturally - AI tracks hand-to-mouth movement (🤏→🤚→👄)
4. **Voice Queries**: Ask "Did I take my morning pills?" or "What medications do I need?"
5. **Emergency Help**: Say "I'm not feeling well" or tap emergency buttons
6. **Language**: Speak in English or Malayalam - the app auto-detects

### For Family Members
1. **Setup**: Add senior profiles and medications
2. **Monitoring**: Receive notifications for missed medications
3. **Emergency Alerts**: Get immediate notifications for health concerns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google AI** for Gemini language model
- **Supabase** for backend infrastructure
- **Next.js** team for the amazing framework
- **Vercel** for Web Speech API insights
- **Senior citizen communities** for feedback and testing

## 📞 Support

For support, email support@careloop.com or open an issue on GitHub.

## 🗺️ Roadmap

- [ ] iOS/Android native apps
- [ ] Real TensorFlow.js integration for pill recognition
- [ ] Advanced health monitoring with vitals tracking
- [ ] Integration with smart home devices
- [ ] Multi-language expansion beyond English/Malayalam
- [ ] Wearable device support with health sensors
- [ ] Telemedicine integration with video calls
- [ ] Machine learning for personalized medication patterns

---

**Made with ❤️ for senior citizens and their families**
