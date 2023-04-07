//Write a c++ program to add two distance (in inch - feet system) using structures.
#include<iostream>
using namespace std;
struct dis
{
    float feet;
    float inch ;
};
int main()
{
    struct dis a1,a2, a3;
    cout<<"Enter 1st distance"<<endl;
    cout<<"Enter feet :";
    cin>> a1.feet;
    cout<<"Enter inch :";
    cin>> a1.inch;

    cout<<endl<<"Enter 2nd distance"<<endl;
    cout<<"Enter feet :";
    cin>> a2.feet;
    cout<<"Enter inch :";
    cin>> a2.inch;
    a3.feet= a1.feet+a2.feet;
    a3.inch= a1.inch+a2.inch;
    if(a3.inch>=12)
    {
        a3.inch=a3.inch-12;
        a3.feet++;
    }
    cout<<endl<<"Sum of distance ="<<a3.feet<<"'-"<<a3.inch<<"\"";
    return 0;
}

