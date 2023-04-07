//Calculate summation of two number untill press negative number in c++
#include <iostream>
using namespace std;
int main()
{
    int num,sum=0;

    cout<<"Enter number (not press negative number)=";
    while(num>=0)
    {
        cin>>num;
        if(num>=0)
        {
            sum=sum+num;
        }
    }
    cout<<"Total number of summation ="<<sum;
}
