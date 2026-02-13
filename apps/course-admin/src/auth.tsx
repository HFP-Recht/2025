import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User
} from "firebase/auth";
import { Navigate } from "react-router-dom";
import type { Role } from "@hfp/content-schema";
import { auth } from "./firebase";

type AuthContextValue = {
  user: User | null;
  role: Role | null;
  classIds: string[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ROLES: Role[] = ["student", "teacher", "admin", "editor"];

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setRole(null);
        setClassIds([]);
        setLoading(false);
        return;
      }

      const token = await nextUser.getIdTokenResult();
      const rawRole = token.claims.role;
      const normalizedRole =
        typeof rawRole === "string" && ROLES.includes(rawRole as Role)
          ? (rawRole as Role)
          : null;

      setRole(normalizedRole);

      const claimClassIds = token.claims.classIds;
      if (Array.isArray(claimClassIds)) {
        setClassIds(claimClassIds.filter((entry): entry is string => typeof entry === "string"));
      } else {
        setClassIds([]);
      }

      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      classIds,
      loading,
      signIn: async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
      },
      signOutUser: async () => {
        await signOut(auth);
      }
    }),
    [user, role, classIds, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}

export function RequireAuth({
  children,
  allowedRoles
}: PropsWithChildren<{ allowedRoles?: Role[] }>): JSX.Element {
  const { user, role, loading } = useAuth();

  if (loading) {
    return <div className="shell-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role))) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
