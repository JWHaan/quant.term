cmake_minimum_required(VERSION 3.20)

project(quant_backtest_engine VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(quant_backtest STATIC
    src/backtest.cpp
    src/fixture.cpp
)

target_include_directories(quant_backtest
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

if(MSVC)
    target_compile_options(quant_backtest PRIVATE /W4 /permissive-)
else()
    target_compile_options(quant_backtest PRIVATE -Wall -Wextra -Wpedantic -Wconversion)
endif()

add_executable(quant-backtest apps/quant_backtest.cpp)
target_link_libraries(quant-backtest PRIVATE quant_backtest)

enable_testing()

add_executable(quant-backtest-tests tests/backtest_test.cpp)
target_link_libraries(quant-backtest-tests PRIVATE quant_backtest)

add_test(NAME quant-backtest-correctness COMMAND quant-backtest-tests)
