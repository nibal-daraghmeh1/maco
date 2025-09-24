# RAEDA Application Deployment Guide

## Quick Setup (5 minutes)

### Prerequisites
1. Install Node.js from https://nodejs.org/
2. Open Command Prompt/Terminal in your project folder

### Option 1: Web App (Simplest)
```bash
# Install dependencies
npm install

# Build the application
npm run build-prod

# Test locally
npm run serve
# Open http://localhost:8080 in browser
```

**Deploy to web:**
- Upload the `dist/` folder to any web hosting service
- Examples: Netlify (free), Vercel (free), or your company's server

### Option 2: Desktop App (Most Secure)

**If you get permission errors, try this simple method:**
```bash
# Install dependencies
npm install

# Create desktop app (simple method)
npm run simple-app

# Find your app in: release/RAEDA Risk Assessment-win32-x64/
```

**Alternative method (if simple method doesn't work):**
```bash
# Run PowerShell as Administrator first!
# Install dependencies
npm install

# Build the web files first
npm run build

# Clean any previous builds (if needed) - PowerShell command:
Remove-Item -Recurse -Force release -ErrorAction SilentlyContinue

# Build desktop app
npm run package

# Find installer in release/ folder
```

## Security Features

### Level 1: Basic Protection
- Code minification (makes code hard to read)
- Basic obfuscation (scrambles variable names)

### Level 2: Advanced Protection
- Code obfuscation with control flow flattening
- Dead code injection (adds fake code)
- String encryption
- Debug protection

### Level 3: Maximum Protection (Desktop App)
- Code is packaged inside executable
- No access to source files
- Prevents developer tools
- Can add license validation

## Deployment Options

### 1. Company Intranet
- Host on internal company server
- Only accessible from company network
- Add login system if needed

### 2. Cloud Hosting
- Netlify/Vercel (free for small teams)
- AWS/Azure (enterprise)
- Can add password protection

### 3. Desktop Distribution
- Create installer (.exe file)
- Distribute to specific users
- Works offline
- Most secure option

## Additional Security Measures

### Server-Side Validation
If you want maximum security, consider:
- Moving calculations to a server
- User authentication
- Usage tracking
- License validation

### Simple License Check
Add this to your main app file:
```javascript
// Simple license validation
const VALID_USERS = ['user1@company.com', 'user2@company.com'];
const userEmail = prompt('Enter your email:');
if (!VALID_USERS.includes(userEmail)) {
    alert('Access denied');
    window.close();
}
```

## Recommended Approach

For your use case, I recommend:

1. **Start with Desktop App** (Electron) - Most secure, works offline
2. **Add basic license validation** - Control who can use it
3. **Distribute via installer** - Easy for users to install

The desktop app approach gives you:
- ✅ Code protection (bundled in executable)
- ✅ Offline functionality
- ✅ Professional appearance
- ✅ Control over distribution
- ✅ No browser dependencies

## Quick Commands Summary

```bash
# Setup (run once)
npm install

# Create web version
npm run build-prod

# Create desktop app
npx electron-builder

# Test web version
npm run serve
```

The desktop app installer will be in the `release/` folder after building.
