#include <iostream>
using namespace std;
int main()
{
    int n,i;
    long double fact=1.0;
    cout<<"Enter a number =";
    cin>>n;
    for( i=1; i<=n ; i++)
    {
        fact*=i;
    }
    cout<<"Factorial number of "<<n<<"number is = "<< fact;
}
