
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ID, Query } from 'appwrite';
import { account, appwriteConfig, databases, getMissingAppwriteConfig } from '@/integrations/appwrite/client';
import {
  AppwriteAdminMembershipDocument,
  AppwriteCreatorProfileDocument,
  AppwriteSession,
  AppwriteSubscriberProfileDocument,
  AppwriteUser,
} from '@/integrations/appwrite/types';
import { hasAdminCapability } from '@/lib/adminAccess';
import { type AdminCapability } from '@/types/admin';

interface AuthContextType {
  user: AppwriteUser | null;
  session: AppwriteSession | null;
  isAdmin: boolean;
  canStream: boolean;
  adminMembership: AppwriteAdminMembershipDocument | null;
  creatorProfile: AppwriteCreatorProfileDocument | null;
  subscriberProfile: AppwriteSubscriberProfileDocument | null;
  loading: boolean;
  hasCapability: (capability: AdminCapability) => boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ data: { session: AppwriteSession; user: AppwriteUser } | null; error: unknown }>;
  signIn: (email: string, password: string) => Promise<{ data: { session: AppwriteSession; user: AppwriteUser } | null; error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppwriteUser | null>(null);
  const [session, setSession] = useState<AppwriteSession | null>(null);
  const [adminMembership, setAdminMembership] = useState<AppwriteAdminMembershipDocument | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<AppwriteCreatorProfileDocument | null>(null);
  const [subscriberProfile, setSubscriberProfile] = useState<AppwriteSubscriberProfileDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = Boolean(
    user?.labels?.includes(import.meta.env.VITE_APPWRITE_ADMIN_LABEL || "admin") &&
      adminMembership?.status === "active"
  );
  const isApprovedCreator = Boolean(
    creatorProfile &&
      (creatorProfile.account_status === "approved" ||
        creatorProfile.account_status === "verified")
  );
  const canStream = Boolean(
    isAdmin ||
      isApprovedCreator ||
      subscriberProfile?.subscription_status === "active"
  );
  const hasCapability = (capability: AdminCapability) =>
    hasAdminCapability(adminMembership?.role, adminMembership?.status, capability);

  const loadAccessProfiles = async (currentUserId: string) => {
    if (!databases) {
      setAdminMembership(null);
      setCreatorProfile(null);
      setSubscriberProfile(null);
      return;
    }

    const [membershipResponse, creatorResponse, subscriberResponse] = await Promise.all([
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.adminMemberships, [
        Query.equal("user_id", [currentUserId]),
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.creatorProfiles, [
        Query.equal("user_id", [currentUserId]),
        Query.limit(1),
      ]),
      databases.listDocuments(appwriteConfig.databaseId, appwriteConfig.collections.subscriberProfiles, [
        Query.equal("user_id", [currentUserId]),
        Query.limit(1),
      ]),
    ]).catch(() => [
      { documents: [] },
      { documents: [] },
      { documents: [] },
    ]);

    setAdminMembership(
      (membershipResponse.documents?.[0] as AppwriteAdminMembershipDocument | undefined) || null
    );
    setCreatorProfile(
      (creatorResponse.documents?.[0] as AppwriteCreatorProfileDocument | undefined) || null
    );
    setSubscriberProfile(
      (subscriberResponse.documents?.[0] as AppwriteSubscriberProfileDocument | undefined) || null
    );
  };

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      if (!account) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const [currentUser, currentSession] = await Promise.all([
          account.get(),
          account.getSession('current'),
        ]);

        if (isMounted) {
          setUser(currentUser);
          setSession(currentSession);
          await loadAccessProfiles(currentUser.$id);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          setSession(null);
          setAdminMembership(null);
          setCreatorProfile(null);
          setSubscriberProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    if (!account) {
      return {
        data: null,
        error: new Error(
          `Missing Appwrite auth configuration: ${getMissingAppwriteConfig('auth').join(', ')}`
        ),
      };
    }

    try {
      await account.create(ID.unique(), email, password, username);
      const createdSession = await account.createEmailPasswordSession(email, password);
      const createdUser = await account.get();

      setSession(createdSession);
      setUser(createdUser);
      await loadAccessProfiles(createdUser.$id);

      return { data: { session: createdSession, user: createdUser }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!account) {
      return {
        data: null,
        error: new Error(
          `Missing Appwrite auth configuration: ${getMissingAppwriteConfig('auth').join(', ')}`
        ),
      };
    }

    try {
      const currentSession = await account.createEmailPasswordSession(email, password);
      const currentUser = await account.get();

      setSession(currentSession);
      setUser(currentUser);
      await loadAccessProfiles(currentUser.$id);

      return { data: { session: currentSession, user: currentUser }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    if (!account) {
      return { error: null };
    }

    try {
      await account.deleteSession('current');
      setSession(null);
      setUser(null);
      setAdminMembership(null);
      setCreatorProfile(null);
      setSubscriberProfile(null);

      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const value = {
    user,
    session,
    isAdmin,
    canStream,
    adminMembership,
    creatorProfile,
    subscriberProfile,
    loading,
    hasCapability,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
