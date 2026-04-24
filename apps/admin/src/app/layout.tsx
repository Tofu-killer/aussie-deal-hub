import React, { type ReactNode } from "react";

import { getAdminBasicAuthConfig } from "../lib/access";

import "./globals.css";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const access = getAdminBasicAuthConfig();

  return (
    <html lang="en">
      <body className="admin-body">
        <div className="admin-backdrop admin-backdrop--gold" aria-hidden="true" />
        <div className="admin-backdrop admin-backdrop--blue" aria-hidden="true" />
        <div className="admin-shell">
          <header className="admin-masthead">
            <div>
              <p className="admin-masthead__eyebrow">Editorial operations console</p>
              <a className="admin-masthead__brand" href="/">
                Aussie Deal Hub Admin
              </a>
            </div>
            <p className="admin-masthead__status">
              {access ? "Protected workspace" : "Unprotected workspace"}
            </p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
