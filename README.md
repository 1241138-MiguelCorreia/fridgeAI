# FridgeAI

A mobile app that helps you manage the food you have at home and waste less of it.
Built at **CodeSpring 2026**, the hackathon organised by NEI-ISEP (Porto, May 2026).

## What it does

- **Inventory by place:** fridge, pantry and freezer, with alerts for products about to expire
- **Add food your way:** manually, by describing it in plain language, or by **scanning a supermarket receipt**
- **Personal profile:** dietary restrictions (vegetarian, vegan, lactose-free, gluten-free, allergies) and a normal or fitness mode
- **Meals and shopping:** meal suggestions and a shopping list based on what you have
- **Accounts:** sign-up, login and password recovery

## Tech stack

| Part | Technologies |
|---|---|
| Mobile app | React Native, Expo (Expo Router) |
| Back end | Node.js, Express, MongoDB (Mongoose) |
| Security | JWT authentication, bcrypt password hashing |
| Receipt scanning | Google Cloud Document AI |

## Architecture

```
fridgeai/
├── mobile/    # React Native app (Expo Router)
└── backend/   # REST API: Node.js + Express + MongoDB
```

The app talks to the back end through a REST API (`/auth`, `/inventory`, `/meals`, `/shopping`, ...).

## Team

Built in a team of three at CodeSpring 2026:

- Miguel Correia ([@1241138-MiguelCorreia](https://github.com/1241138-MiguelCorreia))
- Marta Gonçalves ([@1241153martagoncalves](https://github.com/1241153martagoncalves))
- Gabriel Ferreira ([@Gabrieldmf1](https://github.com/Gabrieldmf1))

## Running it locally

**Requirements:** Node.js 18+, MongoDB (local or Atlas), Expo Go on your phone or an iOS/Android simulator.

**Back end**

```bash
cd backend
cp .env.example .env   # add your MongoDB URI and a JWT secret
npm install
npm run dev            # http://localhost:3000
```

Receipt scanning needs your own Google Cloud service account key. Point
`GOOGLE_APPLICATION_CREDENTIALS` in `.env` to that file. Keys are never committed to this repository.

**Mobile app**

```bash
cd mobile
npm install
npx expo start
```

On a physical phone, replace `localhost` in `mobile/services/api.js` with your computer's local IP.

## Next steps

- Replace the mock natural-language parser with a real AI model
- Fitness mode with calories and macros
- Push notifications for products about to expire
