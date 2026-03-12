"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Standings" },
  { href: "/events", label: "Events" },
  { href: "/head-to-head", label: "Head-to-Head" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-14">
        <div className="flex items-center gap-3 mr-8">
          <span className="text-xl">⛳</span>
          <span className="font-bold text-white tracking-tight">HEC Winter League</span>
          <span className="text-xs text-gray-500 font-mono">2025–26</span>
        </div>
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
