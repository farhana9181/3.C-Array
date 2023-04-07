#include<iostream>
using namespace std;
int main()
{
    int  dis , fuel ;
    float avrg;
    cout<< "Input total distance in (km)  = ";
    cin>> dis;
     cout<< "Input total fuel spent in (liters)  = ";
    cin>> fuel;

    avrg = dis/fuel;

    cout<< "Average consumption (km/lt) = "<< avrg;
    return 0;
}
