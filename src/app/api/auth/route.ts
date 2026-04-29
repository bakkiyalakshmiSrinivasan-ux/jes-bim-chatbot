import { NextResponse } from "next/server";
import { SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "default_super_secret_for_jes_bim";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    const users = {
      admin: { password: "password", role: "Admin", name: "System Admin" },
      manager: { password: "password", role: "Manager", name: "Project Manager" },
      viewer: { password: "password", role: "Viewer", name: "Operation Viewer" }
    };

    const user = users[username as keyof typeof users];

    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const secretKey = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT({ username, role: user.role, name: user.name })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(secretKey);

    return NextResponse.json({ token, user: { username, role: user.role, name: user.name } }, { status: 200 });
  } catch (error) {
    console.error("Auth ERROR:", error);
    return NextResponse.json({ error: "Internal Authentication failed" }, { status: 500 });
  }
}
