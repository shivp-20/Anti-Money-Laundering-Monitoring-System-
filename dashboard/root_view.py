from django.http import HttpResponse
from django.shortcuts import redirect

def root_view(request):
    return redirect('/api/')
