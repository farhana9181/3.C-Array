#include <iostream>
using namespace std;
int main()
{
    int l ;
    cout<<"Enter a year = ";
    cin>> l;

    if(l%4==0 && l%100 !=0)
    {
        cout<<l<<" is  Leap Year ..";
    }else if (l%400==0)
    {
        cout<<l<<" is  Leap Year ..";
    }else{
     cout<<l<<" is not  Leap Year ..";
    }
}
