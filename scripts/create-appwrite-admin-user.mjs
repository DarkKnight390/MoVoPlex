import crypto from "node:crypto";
import { loadEnvFiles, getMissingEnv, createAppwriteRequest } from "./appwrite-env.mjs";

loadEnvFiles();

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const adminEmail = process.env.APPWRITE_ADMIN_EMAIL;
const adminName = process.env.APPWRITE_ADMIN_NAME || "MoVoPlex Admin";
const adminUserId = process.env.APPWRITE_ADMIN_USER_ID || "movoplex-admin";
const adminRole = process.env.APPWRITE_ADMIN_ROLE || "super_admin";
const adminLabel =
  process.env.APPWRITE_ADMIN_LABEL ||
  process.env.VITE_APPWRITE_ADMIN_LABEL ||
  "admin";
const providedAdminPassword = process.env.APPWRITE_ADMIN_PASSWORD;
const adminMembershipsCollectionId =
  process.env.APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
  process.env.VITE_APPWRITE_ADMIN_MEMBERSHIPS_COLLECTION_ID ||
  "admin_memberships";

const missing = getMissingEnv([
  "VITE_APPWRITE_ENDPOINT",
  "VITE_APPWRITE_PROJECT_ID",
  "VITE_APPWRITE_DATABASE_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_ADMIN_EMAIL",
]);

if (missing.length > 0) {
  console.error(
    `Missing required environment variables for Appwrite admin bootstrap: ${missing.join(", ")}`
  );
  process.exit(1);
}

const request = createAppwriteRequest({
  endpoint,
  projectId,
  apiKey,
});

const generatedPassword = crypto.randomBytes(18).toString("base64url");
const adminPassword = providedAdminPassword || generatedPassword;
const passwordWasGenerated = !providedAdminPassword;

const getUser = async (userId) => request("GET", `/users/${userId}`);

let user;
let wasCreated = false;

try {
  user = await getUser(adminUserId);
  console.log(`user:${adminUserId}: found`);
} catch (error) {
  if (error.statusCode !== 404) {
    throw error;
  }

  try {
    user = await request("POST", "/users", {
      userId: adminUserId,
      email: adminEmail,
      password: adminPassword,
      name: adminName,
    });
    wasCreated = true;
    console.log(`user:${adminUserId}: created`);
  } catch (createError) {
    if (createError.statusCode === 409) {
      throw new Error(
        `An Appwrite user with ID "${adminUserId}" or email "${adminEmail}" already exists. ` +
          "Set APPWRITE_ADMIN_USER_ID to that existing account ID or update APPWRITE_ADMIN_EMAIL and run the script again."
      );
    }

    throw createError;
  }
}

if (!wasCreated) {
  if (user.email !== adminEmail) {
    user = await request("PATCH", `/users/${adminUserId}/email`, {
      email: adminEmail,
    });
    console.log(`user:${adminUserId}: email synced`);
  }

  if (user.name !== adminName) {
    user = await request("PATCH", `/users/${adminUserId}/name`, {
      name: adminName,
    });
    console.log(`user:${adminUserId}: name synced`);
  }

  if (providedAdminPassword) {
    await request("PATCH", `/users/${adminUserId}/password`, {
      password: providedAdminPassword,
    });
    console.log(`user:${adminUserId}: password updated`);
  }
}

const currentLabels = Array.isArray(user?.labels) ? user.labels : [];
const nextLabels = [...new Set([...currentLabels, adminLabel])];

if (
  nextLabels.length !== currentLabels.length ||
  !currentLabels.includes(adminLabel)
) {
  await request("PUT", `/users/${adminUserId}/labels`, {
    labels: nextLabels,
  });
  console.log(`user:${adminUserId}: labels synced`);
}

try {
  await request(
    "POST",
    `/databases/${databaseId}/collections/${adminMembershipsCollectionId}/documents`,
    {
      documentId: adminUserId,
      data: {
        user_id: adminUserId,
        role: adminRole,
        status: "active",
        display_name: adminName,
        notes: "Bootstrapped by create-appwrite-admin-user.mjs",
      },
    }
  );
  console.log(`admin-membership:${adminUserId}: created`);
} catch (membershipError) {
  if (membershipError.statusCode !== 409) {
    throw membershipError;
  }

  await request(
    "PATCH",
    `/databases/${databaseId}/collections/${adminMembershipsCollectionId}/documents/${adminUserId}`,
    {
      data: {
        user_id: adminUserId,
        role: adminRole,
        status: "active",
        display_name: adminName,
        notes: "Bootstrapped by create-appwrite-admin-user.mjs",
      },
    }
  );
  console.log(`admin-membership:${adminUserId}: updated`);
}

console.log("");
console.log("Appwrite admin account is ready.");
console.log(`User ID: ${adminUserId}`);
console.log(`Email: ${adminEmail}`);
console.log(`Admin label: ${adminLabel}`);
console.log(`Admin role: ${adminRole}`);

if (wasCreated) {
  console.log(`Password: ${adminPassword}`);

  if (passwordWasGenerated) {
    console.log("Save this generated password now. It is not stored anywhere else locally.");
  }
} else if (providedAdminPassword) {
  console.log("Password: updated from APPWRITE_ADMIN_PASSWORD");
} else {
  console.log(
    "Password: unchanged because APPWRITE_ADMIN_PASSWORD was not provided for an existing user."
  );
}
