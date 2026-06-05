cmake_minimum_required(VERSION 3.8)
project(amrdetail_slam)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY config launch
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
