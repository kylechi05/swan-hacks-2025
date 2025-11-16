import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

import { NavBar } from "./components/NavBar";
import { AuthProvider } from "./authContext";


const montserrat = Montserrat({
    subsets: ["latin"],
    variable: "--font-montserrat",
});

export const metadata: Metadata = {
    title: "TutorLink",
    description: "Connect with Tutors anywhere.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${montserrat.variable} font-montserrat antialiased bg-(--background) relative`}
            >
                <AuthProvider>
                    <NavBar />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
