from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AccountViewSet, AlertViewSet, UploadView, TaskStatusView, SignupView, GoogleLoginView, SARGenerationView
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='accounts')
router.register(r'alerts', AlertViewSet, basename='alerts')

urlpatterns = [
    path('api/', include(router.urls)),
    path('api/upload/', UploadView.as_view(), name='file-upload'),
    path('api/task-status/<str:task_id>/', TaskStatusView.as_view(), name='task-status'),
    path('api/signup/', SignupView.as_view(), name='signup'),
    path('api/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/google-login/', GoogleLoginView.as_view(), name='google-login'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/generate-sar/<int:alert_id>/', SARGenerationView.as_view(), name='generate-sar'),
]
