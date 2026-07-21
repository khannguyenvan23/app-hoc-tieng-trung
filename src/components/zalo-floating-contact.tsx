import {
  communityJoinUrl,
  defaultZaloContacts,
  hasZaloGroupUrl,
} from "@/lib/community";

export function ZaloFloatingContact() {
  return (
    <details className="group fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
      <summary
        aria-label="Mở liên hệ Zalo CSKH"
        className="flex min-h-14 cursor-pointer list-none flex-col items-center justify-center rounded-full bg-blue-600 px-5 text-center text-sm font-semibold leading-tight text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 [&::-webkit-details-marker]:hidden"
      >
        <span>Zalo CSKH</span>
        
      </summary>
      <div className="absolute bottom-full right-0 mb-2 w-56 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#171a19] p-2 text-sm shadow-xl">
        <div className="px-2 pb-2 pt-1 font-semibold text-zinc-900 dark:text-zinc-100">
          Liên hệ Zalo
        </div>
        <div className="grid gap-1">
          <a
            className="rounded-md bg-blue-50 px-3 py-2 text-blue-700 hover:bg-blue-100"
            href={communityJoinUrl}
            rel="noreferrer"
            target="_blank"
          >
            <span className="block text-xs text-blue-500">
              {hasZaloGroupUrl ? "Nhóm học viên" : "Liên hệ để nhận link nhóm"}
            </span>
            <span className="font-semibold">Vào nhóm Zalo</span>
          </a>
          {defaultZaloContacts.map((contact) => (
            <a
              className="rounded-md px-3 py-2 text-zinc-800 dark:text-zinc-100 hover:bg-blue-50 hover:text-blue-700"
              href={`https://zalo.me/${contact.phone}`}
              key={contact.phone}
              rel="noreferrer"
              target="_blank"
            >
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {contact.label}
              </span>
              <span className="font-semibold">{contact.phone}</span>
            </a>
          ))}
        </div>
      </div>
    </details>
  );
}
