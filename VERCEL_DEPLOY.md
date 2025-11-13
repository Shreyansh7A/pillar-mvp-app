# Deploy to Vercel - Quick Guide

## Step 1: Login to Vercel
```bash
vercel login
```
This will open your browser to authenticate.

## Step 2: Deploy
```bash
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No (first time)
- **Project name?** → Press Enter (uses folder name) or type a name
- **Directory?** → Press Enter (uses current directory)
- **Override settings?** → No

## Step 3: Production Deploy
After the first deploy, deploy to production:
```bash
vercel --prod
```

## Step 4: Add Custom Domain (Optional)
1. Go to https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Domains**
4. Add your domain name
5. Vercel will automatically:
   - Set up HTTPS
   - Configure DNS (or you can add DNS records)
   - Provide SSL certificate

## Your App Will Be Live At:
- `https://your-project-name.vercel.app` (automatic)
- `https://your-custom-domain.com` (after adding domain)

## That's It!
✅ Automatic HTTPS
✅ No certificate warnings
✅ Works on all devices
✅ Accessible from anywhere

