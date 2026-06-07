# Rooms Module

Owns room-status views for waiters and TV display.

## Includes

- room status view
- remaining minutes
- expected end time
- display status
- waiter guidance text
- TV display card data

## Upstream

- `calls` for active reservations and usage
- `masters` for rooms and course display data

## Downstream

- dashboard and room-display screens

## Does Not Own

- service-call mutation
- settlement calculation
- monthly close data

