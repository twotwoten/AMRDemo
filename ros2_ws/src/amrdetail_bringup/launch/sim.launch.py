"""Launch Gazebo turtlebot3_world with rosbridge_server for AMRDetail Milestone 1A."""

from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, DeclareLaunchArgument
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    use_sim_time = LaunchConfiguration("use_sim_time")

    turtlebot3_gazebo_launch = PathJoinSubstitution(
        [
            FindPackageShare("turtlebot3_gazebo"),
            "launch",
            "turtlebot3_world.launch.py",
        ]
    )

    return LaunchDescription(
        [
            DeclareLaunchArgument(
                "use_sim_time",
                default_value="true",
                description="Use simulation clock from Gazebo.",
            ),
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource([turtlebot3_gazebo_launch]),
            ),
            Node(
                package="rosbridge_server",
                executable="rosbridge_websocket",
                name="rosbridge_websocket",
                parameters=[{"use_sim_time": use_sim_time, "port": 9090}],
                output="screen",
            ),
        ]
    )
