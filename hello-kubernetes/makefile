DOCKER_IMAGE_PREFIX ?=hello-k8s-
APPS                ?=node python

include ../docker.mk
include ../validate.mk

metrics-server:
	minikube addons enable metrics-server

redis-cluster:
	helm repo add bitnami https://charts.bitnami.com/bitnami
	helm repo update
	helm upgrade -i my-release bitnami/redis