from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from app.auth import ADMIN_USERNAME, ADMIN_PASSWORD, EXPIRE_DAYS, COOKIE_SECURE, create_token, require_auth

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login", status_code=204)
def login(payload: LoginRequest, response: Response):
    if payload.username != ADMIN_USERNAME or payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    response.set_cookie(
        key="auth_token",
        value=create_token(),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=EXPIRE_DAYS * 86400,
        path="/",
    )


@router.get("/verify", status_code=204)
def verify(_: None = Depends(require_auth)):
    pass


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("auth_token", path="/")
