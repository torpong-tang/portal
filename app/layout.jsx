import './globals.css';

export const metadata = {
    title: 'Projects Portal',
    description: 'Manage and launch your local WSL projects from one beautiful place.',
    icons: {
        icon: '/assets/logo.png'
    }
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                {children}
            </body>
        </html>
    );
}
