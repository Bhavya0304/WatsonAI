from fastapi import APIRouter

from api.models import (
    ChatRequest,
    ChatResponse
)

from services.service_provider import (
    chat_service
)

router = APIRouter()


@router.post(
    "/chat",
    response_model=ChatResponse
)
def chat(
    request: ChatRequest
):

    response = chat_service.send_message(
        session_id=request.session_id,
        user_message=request.message
    )

    return ChatResponse(
        response=response
    )