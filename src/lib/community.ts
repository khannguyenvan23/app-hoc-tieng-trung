export const defaultZaloContacts = [
  {
    label: "SĐT 1",
    phone: "0986942504",
  },
  {
    label: "SĐT 2",
    phone: "0889737768",
  },
] as const;

export const zaloGroupUrl =
  process.env.NEXT_PUBLIC_ZALO_GROUP_URL?.trim() || "";

export const primaryZaloContactUrl = `https://zalo.me/${defaultZaloContacts[0].phone}`;

export const communityJoinUrl = zaloGroupUrl || primaryZaloContactUrl;

export const hasZaloGroupUrl = Boolean(zaloGroupUrl);

