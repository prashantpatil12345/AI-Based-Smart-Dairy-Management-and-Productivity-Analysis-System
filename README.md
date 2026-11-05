\# AI-Based Smart Dairy Management and Productivity Analysis System



\## Project Overview



SmartDairy is an AI-assisted dairy management system designed to help dairy farmers manage livestock, monitor milk production, maintain animal health records, and perform cattle breed classification.



\## Project Structure



```text

AI-Based-Smart-Dairy-Management-and-Productivity-Analysis-System/

│

├── .gitignore

├── README.md

├── .vscode/

│

└── MAIN/

&#x20;   ├── src/

&#x20;   ├── public/

&#x20;   ├── supabase/

&#x20;   ├── docs/

&#x20;   ├── ml-service/

&#x20;   ├── cattle-breed-classifier-webapp-master/

&#x20;   ├── package.json

&#x20;   └── package-lock.json

```



\## Technology Stack



\- React

\- TypeScript

\- Vite

\- Supabase

\- Tailwind CSS

\- AI-based cattle breed recognition

\- Python and machine learning components



\## Main Features



\- User authentication

\- Dashboard and analytics

\- Cattle management

\- AI-assisted cattle breed recognition

\- Milk production tracking

\- Animal health monitoring

\- Reports and productivity analysis



\## Cattle Breed Classification



The project includes a separate cattle breed classification component containing:



\- Cattle breed image dataset

\- Machine learning source code

\- Training notebooks

\- Model configurations

\- Evaluation reports and visualizations

\- Backend and frontend components



Refer to the documentation inside `MAIN/docs/` for further technical details.



\## How to Run the Main Application



\### Prerequisites



\- Node.js

\- npm

\- Git

\- Configured Supabase project



\### Step 1: Open the MAIN directory



```powershell

cd MAIN

```



\### Step 2: Install dependencies



```powershell

npm install

```



\### Step 3: Configure environment variables



Create a `.env` file inside `MAIN` and configure the required variables:



\- `VITE\_SUPABASE\_URL`

\- `VITE\_SUPABASE\_PUBLISHABLE\_KEY`



Use your own authorized Supabase project configuration. Never upload actual secrets or API keys to GitHub.



\### Step 4: Start the development server



```powershell

npm run dev

```



Open the local URL displayed in the terminal.



\### Step 5: Build the application



```powershell

npm run build

```



\## Project Documentation



Detailed technical documentation, API information, and troubleshooting guides are available inside:



`MAIN/docs/`



\## Project Objective



The objective of SmartDairy is to combine digital dairy management, milk productivity monitoring, livestock health management, and AI-assisted cattle breed identification into an integrated system supporting organized and data-driven dairy farming.

