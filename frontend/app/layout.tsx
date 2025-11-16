import type { Metadata } from "next";
import { Montserrat, Elms_Sans, Poppins } from "next/font/google";
import "./globals.css";

import { NavBar } from "./components/NavBar";
import { AuthProvider } from "./authContext";


const montserrat = Montserrat({
    subsets: ["latin"],
    variable: "--font-montserrat",
});

const elms_sans = Elms_Sans({
    subsets: ["latin"],
    variable: "--font-elms-sans",
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
                className={`${montserrat.variable} ${elms_sans.variable} font-elms-sans antialiased bg-(--background) relative`}
            >
                <AuthProvider>
                    <NavBar />
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
