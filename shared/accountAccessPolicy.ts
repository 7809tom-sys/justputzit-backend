export function getAccountAccessBlock(role: string | null | undefined) {
  if (role === "banned") {
    return "Your account has been suspended while it is under review. Please contact support if you believe this is a mistake.";
  }
  return null;
}
