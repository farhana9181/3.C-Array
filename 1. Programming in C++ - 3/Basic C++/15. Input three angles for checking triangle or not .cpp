#include<iostream>
using namespace std;
int tri(int a, int b , int c);
int main()
{
    int x,y,z, ang;
    cout<<"Input 1st Angle = ";
    cin>>x;
    cout<<"Input Second Angle = ";
    cin>>y;
    cout<<"Input 3rd Angle = ";
    cin>>z;
    ang= tri(x,y,z);
    cout<<"Total Angle is = "<<ang<<endl;
    if(ang==180 && x!=0 && y!=0 && z!=0)
    {
        cout<<"**So this is a Triangle..**";
    }
    else
    {
        cout<<"**So this is not a Triangle..**";
    }
}
int tri(int a, int b , int c)
{
    return a+b+c;
}

