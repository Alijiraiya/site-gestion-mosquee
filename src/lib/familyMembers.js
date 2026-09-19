import { prisma } from "@/lib/prisma";
import { dateField, numberField, requiredText } from "@/lib/validate";

// FamilyMemberRole enum values from the Prisma schema.
export const FAMILY_MEMBER_ROLES = [
  "HEAD",
  "SPOUSE",
  "CHILD",
  "PARENT",
  "OTHER",
];

// Serialize a FamilyMember for API responses (Decimal -> number).
export function toMemberResponse(m) {
  return {
    id: m.id,
    familyId: m.familyId,
    firstName: m.firstName,
    lastName: m.lastName,
    dateOfBirth: m.dateOfBirth,
    role: m.role,
    hasDisability: m.hasDisability,
    diseases: m.diseases,
    occupation: m.occupation,
    monthlyIncome:
      m.monthlyIncome === null || m.monthlyIncome === undefined
        ? null
        : Number(m.monthlyIncome),
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

// Find a family that is linked to the given mosque (multi-tenant guard).
// The default projection carries the few fields the member routes need to keep
// the family consistent (marital status + declared household size), so they do
// not have to re-query the family after every write.
export async function findLinkedFamily(mosqueId, familyId, select) {
  return prisma.family.findFirst({
    where: { id: familyId, mosqueFamilies: { some: { mosqueId } } },
    select:
      select ?? {
        id: true,
        firstName: true,
        lastName: true,
        maritalStatus: true,
        membersCount: true,
      },
  });
}

// Find a member and confirm it belongs to a family linked to the mosque.
export async function findLinkedMember(mosqueId, memberId) {
  return prisma.familyMember.findFirst({
    where: {
      id: memberId,
      family: { mosqueFamilies: { some: { mosqueId } } },
    },
  });
}

// Build a Prisma data object from a request body.
// mode "create" enforces required fields; mode "update" only maps provided keys.
// Returns [data, errorMessage].
//
// Every optional field is now validated instead of being coerced blindly.
// `Number(true)` used to become 1 and `new Date("0000-00-00")` an Invalid Date,
// both of which reached Prisma and came back as an empty HTTP 500.
export function buildMemberData(body, { mode = "create", forcedRole } = {}) {
  const data = {};

  if (mode === "create") {
    const [firstName, nameMsg] = requiredText(body.firstName, "firstName", {
      maxLength: 120,
    });
    if (nameMsg) return [null, "firstName is required."];
    const role = forcedRole ?? body.role;
    if (!role) return [null, "role is required."];
    if (!FAMILY_MEMBER_ROLES.includes(role)) {
      return [null, `Invalid role: ${role}`];
    }
    data.firstName = firstName;
    data.role = role;
  } else {
    if (body.firstName !== undefined) {
      // A PUT used to accept an empty first name where a POST refused it, so a
      // member could be renamed into a nameless row.
      const [firstName, nameMsg] = requiredText(body.firstName, "firstName", {
        maxLength: 120,
      });
      if (nameMsg) return [null, "firstName cannot be empty."];
      data.firstName = firstName;
    }
    if (forcedRole !== undefined) {
      data.role = forcedRole;
    } else if (body.role !== undefined) {
      if (!FAMILY_MEMBER_ROLES.includes(body.role)) {
        return [null, `Invalid role: ${body.role}`];
      }
      data.role = body.role;
    }
  }

  if (body.lastName !== undefined) {
    if (body.lastName === null || body.lastName === "") data.lastName = null;
    else {
      const [lastName, msg] = requiredText(body.lastName, "lastName", {
        maxLength: 120,
      });
      if (msg) return [null, msg];
      data.lastName = lastName;
    }
  }

  if (body.dateOfBirth !== undefined) {
    const [dob, msg] = dateField(body.dateOfBirth, "dateOfBirth", {
      allowNull: true,
    });
    if (msg) return [null, msg];
    data.dateOfBirth = dob;
  }

  if (body.hasDisability !== undefined) {
    data.hasDisability = Boolean(body.hasDisability);
  }

  if (body.diseases !== undefined) {
    if (body.diseases === null || body.diseases === "") data.diseases = null;
    else if (typeof body.diseases !== "string") {
      return [null, "diseases must be a text value."];
    } else data.diseases = body.diseases.slice(0, 500);
  }

  if (body.occupation !== undefined) {
    if (body.occupation === null || body.occupation === "")
      data.occupation = null;
    else if (typeof body.occupation !== "string") {
      return [null, "occupation must be a text value."];
    } else data.occupation = body.occupation.slice(0, 200);
  }

  if (body.monthlyIncome !== undefined) {
    if (body.monthlyIncome === null || body.monthlyIncome === "") {
      data.monthlyIncome = null;
    } else {
      const [income, msg] = numberField(body.monthlyIncome, "monthlyIncome");
      if (msg) return [null, msg];
      data.monthlyIncome = income;
    }
  }

  return [data, null];
}
