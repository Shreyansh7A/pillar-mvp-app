# HTTPS Setup Guide for Mobile Testing

## Quick Fix: Bypass Browser Warning

If you're seeing a security warning, here's how to bypass it:

### iOS Safari:
1. Open `https://YOUR_IP:5173` (e.g., `https://192.168.10.7:5173`)
2. You'll see "This Connection is Not Private"
3. Tap **"Show Details"** at the bottom
4. Tap **"visit this website"** 
5. Tap **"Visit Website"** in the confirmation popup

### Android Chrome:
1. Open `https://YOUR_IP:5173`
2. You'll see "Your connection is not private"
3. Tap **"Advanced"** at the bottom
4. Tap **"Proceed to [IP address] (unsafe)"**

### iOS Chrome:
1. Open `https://YOUR_IP:5173`
2. Tap **"Advanced"**
3. Tap **"Proceed to [IP address]"**

---

## Better Solution: Use mkcert (Trusted Certificates)

This creates certificates that browsers automatically trust - no warnings!

### Step 1: Install mkcert
```bash
brew install mkcert
```

### Step 2: Install local CA
```bash
mkcert -install
```

### Step 3: Generate certificates
Replace `192.168.10.7` with your actual IP address:
```bash
mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 192.168.10.7
```

### Step 4: Restart the dev server
```bash
npm run dev:https
```

Now browsers will trust the certificate automatically! No warnings needed.

---

## Find Your IP Address

Run this command to find your local IP:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Or on Mac:
```bash
ipconfig getifaddr en0
```

---

## Troubleshooting

**If mkcert command not found:**
- Make sure Homebrew is installed: `brew --version`
- Install Homebrew if needed: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

**If still having issues:**
- Make sure both devices are on the same Wi-Fi network
- Check your firewall isn't blocking port 5173
- Try accessing from your computer first: `https://localhost:5173`

