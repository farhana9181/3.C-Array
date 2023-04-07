//("GDC/HCF")/LCD
#include<iostream>
using namespace std;
int main()
{
    int n1,n2,rem,x,y;
    int lcd,gcd;
    x=n1;
    y=n2;
    cout<< "Enter number 1 =";
    cin>> n1;
    cout<<"Enter number 2 =";
        cin>> n2;
    while(n2 != 0)
    {
        rem=n1%n2;
        n1=n2;
        n2=rem;
    }
    gcd=n1;
        lcd= x*y/gcd;
    cout<< "** HCF / GDC Value ** =   "<< gcd<<endl;


    cout<< "** LCD Value ** =   "<< lcd;
    return 0;

}
