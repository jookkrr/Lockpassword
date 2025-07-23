from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from datetime import datetime, timedelta
import os
import uuid
from typing import Optional

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]
passwords_collection = db.passwords

class PasswordCreate(BaseModel):
    password: str
    days: int
    description: Optional[str] = ""

class PasswordResponse(BaseModel):
    id: str
    description: str
    created_at: datetime
    expires_at: datetime
    is_expired: bool
    remaining_time: dict

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "developer": "Eng Youssef Elattar"}

@app.post("/api/passwords", response_model=PasswordResponse)
async def store_password(password_data: PasswordCreate):
    """Store a password with time lock"""
    if password_data.days < 1 or password_data.days > 100:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 100")
    
    created_at = datetime.utcnow()
    expires_at = created_at + timedelta(days=password_data.days)
    
    password_doc = {
        "id": str(uuid.uuid4()),
        "password": password_data.password,
        "description": password_data.description,
        "created_at": created_at,
        "expires_at": expires_at,
        "is_active": True
    }
    
    passwords_collection.insert_one(password_doc)
    
    # Calculate remaining time
    remaining_delta = expires_at - datetime.utcnow()
    remaining_time = {
        "days": remaining_delta.days,
        "hours": remaining_delta.seconds // 3600,
        "minutes": (remaining_delta.seconds % 3600) // 60,
        "total_seconds": int(remaining_delta.total_seconds())
    }
    
    return PasswordResponse(
        id=password_doc["id"],
        description=password_doc["description"],
        created_at=password_doc["created_at"],
        expires_at=password_doc["expires_at"],
        is_expired=False,
        remaining_time=remaining_time
    )

@app.get("/api/passwords")
async def get_active_passwords():
    """Get all active password entries (without the actual passwords)"""
    passwords = list(passwords_collection.find({"is_active": True}, {"password": 0}))
    
    result = []
    for pwd in passwords:
        remaining_delta = pwd["expires_at"] - datetime.utcnow()
        is_expired = remaining_delta.total_seconds() <= 0
        
        if is_expired:
            # Update the password as inactive if expired
            passwords_collection.update_one(
                {"id": pwd["id"]}, 
                {"$set": {"is_active": False}}
            )
        
        remaining_time = {
            "days": max(0, remaining_delta.days),
            "hours": max(0, remaining_delta.seconds // 3600),
            "minutes": max(0, (remaining_delta.seconds % 3600) // 60),
            "total_seconds": max(0, int(remaining_delta.total_seconds()))
        }
        
        result.append({
            "id": pwd["id"],
            "description": pwd["description"],
            "created_at": pwd["created_at"],
            "expires_at": pwd["expires_at"],
            "is_expired": is_expired,
            "remaining_time": remaining_time
        })
    
    return result

@app.get("/api/passwords/{password_id}")
async def get_password_details(password_id: str):
    """Get password details including remaining time"""
    password = passwords_collection.find_one({"id": password_id, "is_active": True})
    
    if not password:
        raise HTTPException(status_code=404, detail="Password not found or expired")
    
    remaining_delta = password["expires_at"] - datetime.utcnow()
    is_expired = remaining_delta.total_seconds() <= 0
    
    if is_expired:
        # Update the password as inactive
        passwords_collection.update_one(
            {"id": password_id}, 
            {"$set": {"is_active": False}}
        )
    
    remaining_time = {
        "days": max(0, remaining_delta.days),
        "hours": max(0, remaining_delta.seconds // 3600),
        "minutes": max(0, (remaining_delta.seconds % 3600) // 60),
        "total_seconds": max(0, int(remaining_delta.total_seconds()))
    }
    
    response = {
        "id": password["id"],
        "description": password["description"],
        "created_at": password["created_at"],
        "expires_at": password["expires_at"],
        "is_expired": is_expired,
        "remaining_time": remaining_time
    }
    
    # Only include password if expired
    if is_expired:
        response["password"] = password["password"]
    
    return response

@app.delete("/api/passwords/{password_id}")
async def delete_password(password_id: str):
    """Delete a password entry"""
    result = passwords_collection.update_one(
        {"id": password_id}, 
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Password not found")
    
    return {"message": "Password deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)