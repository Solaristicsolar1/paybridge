"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  authApi,
  businessesApi,
  ApiError,
  type MyBusiness,
  type Role,
  type User,
} from "@/lib/api";

import { canManageTeam } from "@/lib/permissions";
import { errorMessage } from "@/hooks/use-resource";
import {
  Alert,
  Brand,
  ErrorState,
  Icon,
  Loading,
  type IconName,
} from "./ui";

interface Workspace {
  user: User;
  business: MyBusiness | null;
  businesses: MyBusiness[];
  role: Role | undefined;
  refreshBusinesses: () => Promise<void>;
  selectBusiness: (id: string) => void;
}

const Context = createContext<Workspace | null>(null);

export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Workspace provider missing");
  return value;
}

const nav: {
  href: string;
  label: string;
  icon: IconName;
  admin?: boolean;
}[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/invoices", label: "Invoices", icon: "invoice" },
  { href: "/clients", label: "Clients", icon: "clients" },
  { href: "/payments", label: "Payments", icon: "payment" },
  { href: "/team", label: "Team", icon: "team", admin: true },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const navigation = useRef<HTMLElement>(null);

  const [user, setUser] = useState<User | null>(null);
  const [businesses, setBusinesses] = useState<MyBusiness[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menu, setMenu] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const refreshBusinesses = useCallback(async () => {
    const data = await businessesApi.list();
    setBusinesses(data);
    setSelected(id =>
      data.some(b => b.id === id) ? id : data[0]?.id || "",
    );
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const me = await authApi.me();
      if (!me.emailVerifiedAt) {
        router.replace("/verify-email");
        return;
      }
      const data = await businessesApi.list();
      setUser(me);
      setBusinesses(data);
      let saved = "";
      try {
        saved = sessionStorage.getItem(`pb:business:${me.id}`) || "";
      } catch {
        // Selection can remain in memory.
      }
      setSelected(data.find(b => b.id === saved)?.id || data[0]?.id || "");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void initialize();
  }, [initialize]);
    
  useEffect(() => {
    const expired = () => {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    };
    const online = () => setOffline(!navigator.onLine);
    online();

    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("paybridge:session-expired", expired);

    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("paybridge:session-expired", expired);
    };
  }, [router]);

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  useEffect(() => {
    if (!menu) return;

    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusable = () =>
      Array.from(
        navigation.current?.querySelectorAll<HTMLElement>(
          "a[href],button:not(:disabled),select",
        ) || [],
      ).filter(el => el.getClientRects().length > 0);

    focusable()[0]?.focus();

    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false);
      }
      if (e.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    const resize = () => {
      if (window.innerWidth > 680) setMenu(false);
    };

    window.addEventListener("keydown", keydown);
    window.addEventListener("resize", resize);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("resize", resize);
      requestAnimationFrame(() => previous?.focus());
    };
  }, [menu]);

  const selectBusiness = useCallback((id: string) => {
    setSelected(id);
    if (user) {
      try {
        sessionStorage.setItem(`pb:business:${user.id}`, id);
      } catch {
        // Selection can remain in memory.
      }
    }
    router.push("/dashboard");
  }, [router, user]);

  const business = businesses.find(b => b.id === selected) || null;
  const role = business?.members[0]?.role;

  if (loading) {
    return <div className="boot"><Brand /><Loading /></div>;
  }

  if (error) {
    return (
      <div className="boot">
        <Brand />
        <ErrorState error={error} retry={() => void initialize()} />
        <Link href="/login">Return to sign in</Link>
      </div>
    );
  }

  if (!user) return <Loading label="Opening sign in…" />;

  return (
    <Context.Provider value={{
      user, business, businesses, role, refreshBusinesses, selectBusiness,
    }}>
      <div className="app-layout">
        {menu && (
          <button
            className="nav-backdrop"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          />
        )}

        <aside
          ref={navigation}
          className={`sidebar ${menu ? "is-open" : ""}`}
          id="workspace-navigation"
        >
          <div className="sidebar-top">
            <Brand />
            <button
              className="icon-button mobile-only"
              aria-label="Close navigation"
              onClick={() => setMenu(false)}
            >
              <Icon name="close" />
            </button>
          </div>

          <label className="business-selector">
            <span>Business workspace</span>
            <select
              aria-label="Select business"
              value={selected}
              onChange={e => selectBusiness(e.target.value)}
            >
              {!businesses.length && (
                <option value="">Create your business</option>
              )}
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </label>

          <Link href="/businesses" className="manage-businesses">
            Manage businesses <Icon name="arrow" size={14} />
                  </Link>
                <nav aria-label="Main navigation">
            {nav
              .filter(item => !item.admin || canManageTeam(role))
              .map(item => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
          </nav>

          <div className="sidebar-bottom">
            <div className="settlement-note">
              <Icon name="wallet" />
              <div>
                Settlement destination
                <strong>USDC on Base</strong>
              </div>
            </div>

            <button
              className="nav-link logout"
              disabled={loggingOut}
              onClick={async () => {
                setLoggingOut(true);
                setError("");
                try {
                  await authApi.logout();
                  router.replace("/login");
                  router.refresh();
                } catch (e) {
                  setError(errorMessage(e));
                  setLoggingOut(false);
                }
              }}
            >
              <Icon name="logout" />
              {loggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </aside>

        <div className="workspace" inert={menu || undefined}>
          <header className="workspace-header">
            <div className="header-location">
              <button
                className="icon-button mobile-only"
                aria-label="Open navigation"
                aria-expanded={menu}
                aria-controls="workspace-navigation"
                onClick={() => setMenu(true)}
              >
                <Icon name="menu" />
              </button>

              <span>
                {business?.name || "Your workspace"}
                <span className="breadcrumb-divider">/</span>
                {nav.find(item => pathname.startsWith(item.href))?.label ||
                  "Businesses"}
              </span>
            </div>

            <Link
              href="/settings"
              className="user-chip"
              aria-label="Your account settings"
            >
              <span className="user-name">
                {user.displayName || user.email}
              </span>
              <span className="avatar">
                {(user.displayName || user.email).slice(0, 2).toUpperCase()}
              </span>
            </Link>
          </header>

          <main id="main-content" className="main-content">
            {offline && (
              <Alert tone="info">
                You’re offline. Reconnect to load records or save changes.
              </Alert>
            )}

            {!business && !pathname.startsWith("/businesses") ? (
              <div className="onboarding">
                <h1>Let’s set up your workspace.</h1>
                <p>
                  Create a business to manage clients, issue invoices and
                  receive stablecoin payments.
                </p>
                <Link className="button" href="/businesses">
                  <Icon name="plus" />
                  Create a business
                </Link>
              </div>
            ) : (
              <div key={business?.id || "onboarding"}>{children}</div>
            )}
          </main>

          <footer className="workspace-footer">
            <span>PayBridge</span>
            <span>Invoices without the crypto complexity.</span>
          </footer>
        </div>
      </div>
    </Context.Provider>
  );
}