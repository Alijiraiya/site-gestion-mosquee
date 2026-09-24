// Platform-level administration: reviewing new mosque registrations.
//
// Every mosque created via /api/auth/register starts as
// verificationStatus = PENDING, but nothing ever reads that field again --
// the imam can sign in and use the mosque immediately, unreviewed (see
// docs/10_Missing_Features.md, "role-based authorization for ADMIN versus
// IMAM"). This module adds the missing moderation step: an ADMIN can list
// pending mosques and approve or reject them.
//
// There is no shared permissions module yet, so the ADMIN/IMAM role check
// (requireAdminRole below) lives here for now, scoped to these routes only.
// Once a cross-cutting permissions.js exists, this check should move there
// instead of being duplicated per module.

import { prisma } from "@/lib/prisma";

export const MOSQUE_VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

// True if this user is allowed to act on the moderation endpoints.
export function requireAdminRole(user) {
  return Boolean(user) && user.role === "ADMIN";
}

// List mosques for the moderation queue, oldest registration first so the
// longest-waiting imam is reviewed first.
// status: optional filter ("PENDING" | "APPROVED" | "REJECTED"); omit to
// list every mosque regardless of review status.
export async function listMosquesForReview({ status } = {}) {
  const where = {};
  if (status) where.verificationStatus = status;

  return prisma.mosque.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      wilaya: true,
      commune: true,
      address: true,
      phone: true,
      email: true,
      verificationStatus: true,
      status: true,
      isVerified: true,
      createdAt: true,
      approvedAt: true,
      imam: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });
}

// Approve a mosque: flips verificationStatus to APPROVED, marks it verified
// and active, and stamps approvedAt. Works from PENDING or from a previous
// REJECTED (a rejection is not final -- an imam can fix their details and
// be reconsidered without creating a new account).
// Returns the updated mosque, or null if the id doesn't exist.
export async function approveMosque(mosqueId) {
  const mosque = await prisma.mosque.findUnique({ where: { id: mosqueId } });
  if (!mosque) return null;

  return prisma.mosque.update({
    where: { id: mosqueId },
    data: {
      verificationStatus: "APPROVED",
      isVerified: true,
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });
}

// Reject a mosque: flips verificationStatus to REJECTED, marks it
// unverified and inactive, and clears any previous approvedAt.
// Returns the updated mosque, or null if the id doesn't exist.
export async function rejectMosque(mosqueId) {
  const mosque = await prisma.mosque.findUnique({ where: { id: mosqueId } });
  if (!mosque) return null;

  return prisma.mosque.update({
    where: { id: mosqueId },
    data: {
      verificationStatus: "REJECTED",
      isVerified: false,
      status: "INACTIVE",
      approvedAt: null,
    },
  });
}
